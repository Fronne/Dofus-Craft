import { useCallback, useEffect, useState } from 'react';
import { getLatestItemPrice, submitCommunityPrice, type LatestItemPrice } from '../../services/community-price-api';

// specs/016-shared-item-prices: an item's shared HDV price in Mode communautaire — the group's latest
// contribution for the item on the active server, shown with its date. Same fetch/cache/refresh
// pattern as useCommunityPrice (research.md §5): the last price seen is kept on the device, shown at
// once on the next visit and used whenever the service can't be reached (FR-011).
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export type SharedItemPrice = { amountKamas: number; contributedAt: string };

export type SharedItemPriceState =
  | { kind: 'loading' }
  | { kind: 'found'; price: SharedItemPrice; stale: boolean }
  | { kind: 'not-found' }
  | { kind: 'unavailable' };

function cacheKey(itemId: string, serverId: string) {
  return `craftcheck-latest-item-price:${serverId}:${itemId}`;
}

function readCache(itemId: string, serverId: string): SharedItemPrice | undefined {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(cacheKey(itemId, serverId)) ?? 'null') as Partial<SharedItemPrice> | null;
    if (!parsed || typeof parsed.amountKamas !== 'number' || typeof parsed.contributedAt !== 'string') return undefined;
    return { amountKamas: parsed.amountKamas, contributedAt: parsed.contributedAt };
  } catch {
    return undefined;
  }
}

function writeCache(itemId: string, serverId: string, price: LatestItemPrice) {
  try {
    window.localStorage.setItem(cacheKey(itemId, serverId), JSON.stringify({ amountKamas: price.amountKamas, contributedAt: price.contributedAt }));
  } catch {
    // localStorage unavailable — the price just won't show while offline.
  }
}

async function fetchState(itemId: string, serverId: string): Promise<SharedItemPriceState> {
  const result = await getLatestItemPrice(itemId, serverId);
  if (result.status === 'found') {
    writeCache(itemId, serverId, result.price);
    return { kind: 'found', price: { amountKamas: result.price.amountKamas, contributedAt: result.price.contributedAt }, stale: false };
  }
  if (result.status === 'not-found') return { kind: 'not-found' };
  const cached = readCache(itemId, serverId);
  return cached ? { kind: 'found', price: cached, stale: true } : { kind: 'unavailable' };
}

// Outside React (the Suivis page, one lookup per pinned item): network first, then the last price
// seen on this device. `undefined` when there's none either way.
export async function lookupLatestItemPrice(itemId: string, serverId: string): Promise<SharedItemPrice | undefined> {
  const state = await fetchState(itemId, serverId);
  return state.kind === 'found' ? state.price : undefined;
}

export function useSharedItemPrice(
  itemId: string | undefined,
  serverId: string | undefined,
  // specs/047-recherche-refresh-prices: a change of this value reads the price again.
  reloadKey = 0,
): readonly [SharedItemPriceState, (amountKamas: number) => Promise<SharedItemPriceState | undefined>] {
  const [state, setState] = useState<SharedItemPriceState>({ kind: 'loading' });

  useEffect(() => {
    if (!itemId || !serverId) return;
    let cancelled = false;
    const cached = readCache(itemId, serverId);
    setState(cached ? { kind: 'found', price: cached, stale: true } : { kind: 'loading' });
    const run = async () => {
      const next = await fetchState(itemId, serverId);
      if (!cancelled) setState(next);
    };
    void run();
    const interval = window.setInterval(() => void run(), REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [itemId, serverId, reloadKey]);

  // US2: shares a validated price (kind 'item'), then reloads the latest price so the date moves to
  // this contribution. If that reload doesn't come back with a price (service unreachable right
  // after, or a Worker without /latest-price yet), the price just shared *is* the latest one: it's
  // kept, dated now, rather than letting the field fall back to empty. On a failed submit:
  // `undefined`, and the displayed state is left alone (FR-011 — the caller keeps showing what the
  // player typed for this visit).
  const commit = useCallback(async (amountKamas: number) => {
    if (!itemId || !serverId) return undefined;
    const submitted = await submitCommunityPrice(itemId, serverId, amountKamas, 'item');
    if (!submitted) return undefined;
    let next = await fetchState(itemId, serverId);
    if (next.kind !== 'found') {
      const price = { itemId, serverId, amountKamas, contributedAt: new Date().toISOString() };
      writeCache(itemId, serverId, price);
      next = { kind: 'found', price: { amountKamas, contributedAt: price.contributedAt }, stale: false };
    }
    setState(next);
    return next;
  }, [itemId, serverId]);

  return [state, commit] as const;
}
