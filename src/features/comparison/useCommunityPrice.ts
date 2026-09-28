import { useCallback, useEffect, useState } from 'react';
import { getCommunityPrice, getCommunityPrices, submitCommunityPrice, type CommunityPriceLookup } from '../../services/community-price-api';
import type { CommunityPrice } from '../../domain/types';

// FR-014 / research.md "Fréquence de rafraîchissement du prix communautaire": refetch on mount
// (i.e. on resource/server change, since that remounts via the key prop) and every 5 minutes
// while the same resource stays displayed, never faster than that.
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

export type CommunityPriceState =
  | { kind: 'loading' }
  | { kind: 'found'; price: CommunityPrice; stale: boolean }
  | { kind: 'not-found' }
  | { kind: 'unavailable' };

function cacheKey(resourceId: string, serverId: string) {
  return `craftcheck-community-price:${serverId}:${resourceId}`;
}

// US5 / specs/010-search-instant-cache (research.md §2): the last community price successfully
// fetched, kept in localStorage (not just sessionStorage — this must also survive closing and
// reopening the tab, not only a same-tab reload) both as a fallback after a failed refetch and,
// since specs/010, read first at mount so it displays instantly instead of a "loading" flash.
function readCache(resourceId: string, serverId: string): CommunityPrice | undefined {
  try {
    const raw = window.localStorage.getItem(cacheKey(resourceId, serverId));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<CommunityPrice>;
    // specs/024-latest-community-price: an entry saved before the latest price existed is ignored,
    // never turned into a price from its median.
    if (
      typeof parsed.medianAmountKamas !== 'number' ||
      typeof parsed.sampleSize !== 'number' ||
      typeof parsed.latestAmountKamas !== 'number' ||
      typeof parsed.latestContributionAt !== 'string'
    ) {
      return undefined;
    }
    return {
      resourceId,
      serverId,
      medianAmountKamas: parsed.medianAmountKamas,
      sampleSize: parsed.sampleSize,
      lastContributionAt: typeof parsed.lastContributionAt === 'string' ? parsed.lastContributionAt : undefined,
      latestAmountKamas: parsed.latestAmountKamas,
      latestContributionAt: parsed.latestContributionAt,
    };
  } catch {
    return undefined;
  }
}

function writeCache(resourceId: string, serverId: string, price: CommunityPrice) {
  try {
    window.localStorage.setItem(cacheKey(resourceId, serverId), JSON.stringify(price));
  } catch {
    // localStorage unavailable — the community price just won't survive a temporary outage.
  }
}

// specs/021-background-data-loading (FR-011): every community-median read made in the same tick —
// the rows of a recipe as they mount, a page filling its gaps — is grouped per server into one
// /community-prices request. A resource missing from the answer has no median (`not-found`).
type Pending = { resourceId: string; resolve: (lookup: CommunityPriceLookup) => void };
const queued = new Map<string, Pending[]>();

function flush(serverId: string) {
  const waiting = queued.get(serverId) ?? [];
  queued.delete(serverId);
  // A lone resource keeps the one-resource read: same answer, and no batch needed.
  if (waiting.length === 1) {
    void getCommunityPrice(waiting[0].resourceId, serverId).catch(() => ({ status: 'unavailable' as const })).then(waiting[0].resolve);
    return;
  }
  void getCommunityPrices(waiting.map((entry) => entry.resourceId), serverId).catch(() => ({ status: 'unavailable' as const })).then((result) => {
    for (const { resourceId, resolve } of waiting) {
      if (result.status === 'unavailable') {
        resolve({ status: 'unavailable' });
        continue;
      }
      const price = result.prices.find((entry) => entry.resourceId === resourceId);
      resolve(price ? { status: 'found', price } : { status: 'not-found' });
    }
  });
}

export function loadCommunityPrice(resourceId: string, serverId: string): Promise<CommunityPriceLookup> {
  return new Promise((resolve) => {
    const waiting = queued.get(serverId);
    if (waiting) {
      waiting.push({ resourceId, resolve });
      return;
    }
    queued.set(serverId, [{ resourceId, resolve }]);
    // Same task, after the current synchronous work: rows mounted in one render share one request.
    queueMicrotask(() => flush(serverId));
  });
}

// One-off read of a resource's shared price (fresh if reachable, else the last cached one), for
// pages that need the value without mounting a hook per resource — e.g. Épinglés, which must sync
// the carnet the same way the Recherche lines do so both pages agree on the craft cost.
export async function lookupCommunityPrice(resourceId: string, serverId: string): Promise<CommunityPrice | undefined> {
  const result = await loadCommunityPrice(resourceId, serverId);
  if (result.status === 'found') {
    writeCache(resourceId, serverId, result.price);
    return result.price;
  }
  if (result.status === 'not-found') return undefined;
  return readCache(resourceId, serverId);
}

// Fetch/cache/refresh logic shared by the price-field prefill (RecherchePage) and the compact
// contribution-count indicator (ResourcePriceInput) — extracted from the former
// CommunityPriceDisplay.tsx block so both consumers reuse the exact same behavior (FR-014).
export function useCommunityPrice(
  resourceId: string,
  serverId: string,
): readonly [CommunityPriceState, (amountKamas: number) => Promise<CommunityPriceState | undefined>] {
  const [state, setState] = useState<CommunityPriceState>({ kind: 'loading' });

  // Pure fetch/cache step, shared by the mount/interval refresh below and by `commit` — computing
  // the next state without applying it lets the effect keep guarding `setState` against a stale
  // resourceId/serverId race (a fetch for a resource the player has since navigated away from),
  // while `commit` (a one-off, user-triggered call for the currently displayed resource) applies
  // it directly.
  const fetchState = useCallback(async (): Promise<CommunityPriceState> => {
    const result = await loadCommunityPrice(resourceId, serverId);
    if (result.status === 'found') {
      writeCache(resourceId, serverId, result.price);
      return { kind: 'found', price: result.price, stale: false };
    }
    if (result.status === 'not-found') return { kind: 'not-found' };
    const cached = readCache(resourceId, serverId);
    return cached ? { kind: 'found', price: cached, stale: true } : { kind: 'unavailable' };
  }, [resourceId, serverId]);

  useEffect(() => {
    let cancelled = false;
    // specs/010-search-instant-cache, FR-001/T010: show a cache hit immediately (marked `stale`)
    // instead of `loading` — the network refresh below still runs right away and will replace it
    // with `stale: false` on success.
    const cached = readCache(resourceId, serverId);
    setState(cached ? { kind: 'found', price: cached, stale: true } : { kind: 'loading' });

    async function run() {
      const next = await fetchState();
      if (!cancelled) setState(next);
    }

    void run();
    const interval = window.setInterval(() => void run(), REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [fetchState]);

  // FR-017/FR-018/FR-020: submit a modified price as a new contribution, then, only on success,
  // reload the median so the field can display the fresh, up-to-date value. On failure, returns
  // `undefined` (never a stale `CommunityPriceState`, which the caller could otherwise mistake for
  // a fresh result and use to overwrite the player's just-typed value) and no reload is attempted,
  // per FR-020's silent-failure rule.
  const commit = useCallback(
    async (amountKamas: number): Promise<CommunityPriceState | undefined> => {
      const result = await submitCommunityPrice(resourceId, serverId, amountKamas);
      if (!result) return undefined;
      const next = await fetchState();
      setState(next);
      return next;
    },
    [resourceId, serverId, fetchState],
  );

  return [state, commit] as const;
}
