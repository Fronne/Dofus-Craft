import { useCallback, useEffect, useState } from 'react';
import { getCommunityPrice, submitCommunityPrice } from '../../services/community-price-api';
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
    if (typeof parsed.medianAmountKamas !== 'number' || typeof parsed.sampleSize !== 'number') {
      return undefined;
    }
    return {
      resourceId,
      serverId,
      medianAmountKamas: parsed.medianAmountKamas,
      sampleSize: parsed.sampleSize,
      lastContributionAt: typeof parsed.lastContributionAt === 'string' ? parsed.lastContributionAt : undefined,
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
    const result = await getCommunityPrice(resourceId, serverId);
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
