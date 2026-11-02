import type { CommunityPrice } from '../../domain/types';
import type { PriceHistory } from '../../domain/price-history';
import { LOT_SIZES, type LotUnitPrices } from '../../domain/lot-price';
import { API_URL, apiHeaders, isRecord, readInit, readParams } from './http';
import {
  isCommunityPriceRow,
  isLatestItemPriceRow,
  isPriceHistory,
  isSharedItemPriceEntry,
  knownAuthor,
  withKnownOrigin,
  type LatestItemPrice,
  type SharedItemPriceEntry,
} from './validation';

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

export type LatestItemPriceLookup =
  | { status: 'found'; price: LatestItemPrice }
  | { status: 'not-found' }
  | { status: 'unavailable' };

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
  return { status: 'found', price: { ...payload, author: knownAuthor(payload.author) } };
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

export type SharedItemPricesLookup = { status: 'found'; items: SharedItemPriceEntry[] } | { status: 'unavailable' };

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
  return { status: 'found', items: payload.items.map((item) => ({ ...item, author: knownAuthor(item.author) })) };
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

// specs/059-prix-par-lot (contracts/community-lot-prices.md): the unit price seen for each lot size of
// resources, from the price of the whole lot. Undefined when the API can't be reached or answers
// something unreadable — the caller then keeps the prices it has, it never invents any.
export async function getCommunityLotPrices(resourceIds: string[], serverId: string): Promise<Record<string, LotUnitPrices> | undefined> {
  const ids = [...new Set(resourceIds)];
  const batches: string[][] = [];
  for (let start = 0; start < ids.length; start += COMMUNITY_PRICES_BATCH) batches.push(ids.slice(start, start + COMMUNITY_PRICES_BATCH));
  const lots: Record<string, LotUnitPrices> = {};
  try {
    const answers = await Promise.all(batches.map(async (batch) => {
      const params = readParams({ serverId, resourceIds: batch.join(',') });
      const response = await fetch(`${API_URL}/community-lot-prices?${params.toString()}`, readInit());
      return response.ok ? (await response.json()) as unknown : undefined;
    }));
    for (const payload of answers) {
      if (!isRecord(payload) || !Array.isArray(payload.prices)) return undefined;
      for (const row of payload.prices) {
        if (!isRecord(row) || typeof row.resourceId !== 'string' || !isRecord(row.lots)) return undefined;
        const unitPrices: LotUnitPrices = {};
        for (const size of LOT_SIZES) {
          const lot = row.lots[String(size)];
          if (isRecord(lot) && typeof lot.lotPriceKamas === 'number' && lot.lotPriceKamas > 0 && typeof lot.observedAt === 'string') {
            unitPrices[size] = { unitPriceKamas: lot.lotPriceKamas / size, date: lot.observedAt };
          }
        }
        lots[row.resourceId] = unitPrices;
      }
    }
  } catch {
    return undefined;
  }
  return lots;
}
