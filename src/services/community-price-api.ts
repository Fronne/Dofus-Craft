import type { CommunityPrice } from '../domain/types';
import { isPriceOrigin } from '../domain/forgemagie';
import { HISTORY_WINDOWS, type PriceHistory, type SharedPrice } from '../domain/price-history';
import { getOrCreateDeviceId } from '../persistence/community-device-id';

const API_URL = import.meta.env.VITE_COMMUNITY_API_URL;
const API_KEY = import.meta.env.VITE_COMMUNITY_API_KEY;

function apiHeaders(extra?: Record<string, string>): HeadersInit {
  return {
    Authorization: `Bearer ${API_KEY}`,
    ...extra,
  };
}

// specs/021-background-data-loading (FR-013): price reads may be served from a 60-second cache
// (the Worker's and the browser's). For that long after this device's own accepted contribution,
// every read asks for fresh data, so the player always sees what they just shared — on the page
// where they typed it as on the Prix and Suivis pages.
const FRESH_READ_WINDOW_MS = 60_000;
let freshReadsUntil = 0;

function readParams(values: Record<string, string>): URLSearchParams {
  const params = new URLSearchParams(values);
  if (Date.now() < freshReadsUntil) params.set('fresh', '1');
  return params;
}

// A fresh read bypasses the browser's HTTP cache too, not only the Worker's.
function readInit(): RequestInit {
  return Date.now() < freshReadsUntil ? { headers: apiHeaders(), cache: 'no-store' } : { headers: apiHeaders() };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// specs/024-latest-community-price: the latest price and its date are required — an answer without
// them (an older Worker) is unusable rather than guessed from the median.
function isCommunityPriceRow(value: unknown): value is CommunityPrice {
  return isRecord(value) &&
    typeof value.resourceId === 'string' &&
    typeof value.serverId === 'string' &&
    typeof value.medianAmountKamas === 'number' &&
    typeof value.sampleSize === 'number' &&
    typeof value.latestAmountKamas === 'number' &&
    typeof value.latestContributionAt === 'string';
}

// specs/025-rune-purchase-import: `latestOrigin` is optional (an older Worker doesn't send it) and an
// unknown value is dropped rather than shown — the page then shows it as a manual entry.
function withKnownOrigin(price: CommunityPrice): CommunityPrice {
  if (price.latestOrigin === undefined || isPriceOrigin(price.latestOrigin)) return price;
  return { ...price, latestOrigin: undefined };
}

export type CommunityPriceLookup =
  | { status: 'found'; price: CommunityPrice }
  | { status: 'not-found' }
  | { status: 'unavailable' };

// Never throws: a network error or an unreachable backend resolves to `{ status: 'unavailable' }`
// rather than an exception, so a failure here can never break the personal-price path around it
// (contracts/community-price-api.md, FR-009).
export async function getCommunityPrice(resourceId: string, serverId: string): Promise<CommunityPriceLookup> {
  const params = readParams({ resourceId, serverId });
  let response: Response;
  try {
    response = await fetch(`${API_URL}/community-price?${params.toString()}`, readInit());
  } catch {
    return { status: 'unavailable' };
  }
  if (response.status === 404) return { status: 'not-found' };
  if (!response.ok) return { status: 'unavailable' };
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { status: 'unavailable' };
  }
  if (!isCommunityPriceRow(payload)) return { status: 'unavailable' };
  return { status: 'found', price: withKnownOrigin(payload) };
}

// specs/016-shared-item-prices: an item's shared HDV price — the latest contribution of the group
// for this item and server, with its date (no median, no contribution count).
export type LatestItemPrice = { itemId: string; serverId: string; amountKamas: number; contributedAt: string };
export type LatestItemPriceLookup =
  | { status: 'found'; price: LatestItemPrice }
  | { status: 'not-found' }
  | { status: 'unavailable' };

function isLatestItemPriceRow(value: unknown): value is LatestItemPrice {
  return isRecord(value) &&
    typeof value.itemId === 'string' &&
    typeof value.serverId === 'string' &&
    typeof value.amountKamas === 'number' &&
    typeof value.contributedAt === 'string';
}

// Never throws, like getCommunityPrice: any failure resolves to `unavailable`.
export async function getLatestItemPrice(itemId: string, serverId: string): Promise<LatestItemPriceLookup> {
  const params = readParams({ itemId, serverId });
  let response: Response;
  try {
    response = await fetch(`${API_URL}/latest-price?${params.toString()}`, readInit());
  } catch {
    return { status: 'unavailable' };
  }
  if (response.status === 404) return { status: 'not-found' };
  if (!response.ok) return { status: 'unavailable' };
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { status: 'unavailable' };
  }
  if (!isLatestItemPriceRow(payload)) return { status: 'unavailable' };
  return { status: 'found', price: payload };
}

function isSharedPrice(value: unknown): value is SharedPrice {
  return isRecord(value) && typeof value.amountKamas === 'number' && typeof value.sharedAt === 'string';
}

function isPriceHistory(value: unknown): value is PriceHistory {
  return isRecord(value) &&
    HISTORY_WINDOWS.every((window) => Array.isArray(value[window]) && (value[window] as unknown[]).every(isSharedPrice));
}

export type PriceHistoryLookup = { status: 'found'; history: PriceHistory } | { status: 'unavailable' };

// specs/018-price-history-windows: every shared price, per window, of a resource ('resource') or an item's HDV price
// ('item') on a server. No price yet is `found` with empty lists; like the reads above, this never
// throws — any failure resolves to `unavailable` (FR-013).
export async function getPriceHistory(kind: 'resource' | 'item', id: string, serverId: string): Promise<PriceHistoryLookup> {
  const params = readParams({ kind, id, serverId });
  let response: Response;
  try {
    response = await fetch(`${API_URL}/price-history?${params.toString()}`, { headers: apiHeaders() });
  } catch {
    return { status: 'unavailable' };
  }
  if (!response.ok) return { status: 'unavailable' };
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { status: 'unavailable' };
  }
  if (!isPriceHistory(payload)) return { status: 'unavailable' };
  return { status: 'found', history: payload };
}

export type SharedItemPriceEntry = { itemId: string; amountKamas: number; contributedAt: string };
export type SharedItemPricesLookup = { status: 'found'; items: SharedItemPriceEntry[] } | { status: 'unavailable' };

function isSharedItemPriceEntry(value: unknown): value is SharedItemPriceEntry {
  return isRecord(value) &&
    typeof value.itemId === 'string' &&
    typeof value.amountKamas === 'number' &&
    typeof value.contributedAt === 'string';
}

// specs/019-craft-profit-list: every item's latest shared HDV price on a server (the Prix page's
// candidates). Like the reads above, this never throws — any failure resolves to `unavailable`.
export async function getSharedItemPrices(serverId: string): Promise<SharedItemPricesLookup> {
  const params = readParams({ serverId });
  let response: Response;
  try {
    response = await fetch(`${API_URL}/item-prices?${params.toString()}`, readInit());
  } catch {
    return { status: 'unavailable' };
  }
  if (!response.ok) return { status: 'unavailable' };
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { status: 'unavailable' };
  }
  if (!isRecord(payload) || !Array.isArray(payload.items) || !payload.items.every(isSharedItemPriceEntry)) {
    return { status: 'unavailable' };
  }
  return { status: 'found', items: payload.items };
}

// specs/021-background-data-loading (FR-010): several resources' community medians in one request
// per batch of 98 (contracts/community-prices.md: D1's 100-parameter limit, minus serverId and the cutoff). Never throws: `unavailable` if any batch fails.
const COMMUNITY_PRICES_BATCH = 98;
export type CommunityPricesLookup = { status: 'found'; prices: CommunityPrice[] } | { status: 'unavailable' };

export async function getCommunityPrices(resourceIds: string[], serverId: string): Promise<CommunityPricesLookup> {
  const ids = [...new Set(resourceIds)];
  const batches: string[][] = [];
  for (let start = 0; start < ids.length; start += COMMUNITY_PRICES_BATCH) batches.push(ids.slice(start, start + COMMUNITY_PRICES_BATCH));
  const results = await Promise.all(batches.map(async (batch): Promise<CommunityPrice[] | undefined> => {
    const params = readParams({ serverId, resourceIds: batch.join(',') });
    try {
      const response = await fetch(`${API_URL}/community-prices?${params.toString()}`, readInit());
      if (!response.ok) return undefined;
      const payload: unknown = await response.json();
      if (!isRecord(payload) || !Array.isArray(payload.prices)) return undefined;
      // The Worker gives the server once, at the top of the answer, not on each price: each row
      // takes the requested server before being checked like a one-resource read. Requiring it on
      // every row made every batched read "unavailable" in production (fixed 2026-09-28).
      const prices: unknown[] = payload.prices.map((row) => (isRecord(row) ? { serverId, ...row } : row));
      if (!prices.every(isCommunityPriceRow)) return undefined;
      return prices.map(withKnownOrigin);
    } catch {
      return undefined;
    }
  }));
  if (results.some((prices) => prices === undefined)) return { status: 'unavailable' };
  return { status: 'found', prices: results.flatMap((prices) => prices ?? []) };
}

// Sends resourceId/serverId/amountKamas plus an anonymous per-device deviceId (specs/004-community-price-sharing
// revision 5, FR-010/FR-021/FR-022) — never any information identifying the player personally.
// Returns undefined on any failure rather than throwing, matching getCommunityPrice.
export async function submitCommunityPrice(
  resourceId: string,
  serverId: string,
  amountKamas: number,
  // specs/016: 'item' for an item's HDV price (stored and outlier-traced as such); omitted for a
  // resource price, so resource contributions are sent exactly as before.
  kind?: 'item',
): Promise<{ id: string } | undefined> {
  const deviceId = getOrCreateDeviceId();
  let response: Response;
  try {
    response = await fetch(`${API_URL}/community-price`, {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(kind ? { resourceId, serverId, amountKamas, deviceId, kind } : { resourceId, serverId, amountKamas, deviceId }),
    });
  } catch {
    return undefined;
  }
  if (!response.ok) return undefined;
  freshReadsUntil = Date.now() + FRESH_READ_WINDOW_MS;
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return undefined;
  }
  if (!isRecord(payload) || typeof payload.id !== 'string') return undefined;
  return { id: payload.id };
}
