import type { CommunityPrice } from '../domain/types';
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCommunityPriceRow(
  value: unknown,
): value is { resourceId: string; serverId: string; medianAmountKamas: number; sampleSize: number; lastContributionAt?: string } {
  return isRecord(value) &&
    typeof value.resourceId === 'string' &&
    typeof value.serverId === 'string' &&
    typeof value.medianAmountKamas === 'number' &&
    typeof value.sampleSize === 'number';
}

export type CommunityPriceLookup =
  | { status: 'found'; price: CommunityPrice }
  | { status: 'not-found' }
  | { status: 'unavailable' };

// Never throws: a network error or an unreachable backend resolves to `{ status: 'unavailable' }`
// rather than an exception, so a failure here can never break the personal-price path around it
// (contracts/community-price-api.md, FR-009).
export async function getCommunityPrice(resourceId: string, serverId: string): Promise<CommunityPriceLookup> {
  const params = new URLSearchParams({ resourceId, serverId });
  let response: Response;
  try {
    response = await fetch(`${API_URL}/community-price?${params.toString()}`, { headers: apiHeaders() });
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
  return { status: 'found', price: payload };
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
  const params = new URLSearchParams({ itemId, serverId });
  let response: Response;
  try {
    response = await fetch(`${API_URL}/latest-price?${params.toString()}`, { headers: apiHeaders() });
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
  const params = new URLSearchParams({ kind, id, serverId });
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
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return undefined;
  }
  if (!isRecord(payload) || typeof payload.id !== 'string') return undefined;
  return { id: payload.id };
}
