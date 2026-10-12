import { useEffect, useState } from 'react';
import { getPriceHistory } from '../../services/community-price-api';
import type { PriceHistory } from '../../domain/price-history';

// specs/017-price-history-chart (research.md §6), specs/018: the load time is kept with the history,
// since the windows are counted back from it.: loaded when a popover opens, then kept in memory for
// the visit — no localStorage, since an old history shown without saying so would mislead. A failed
// load isn't cached, so reopening the popover tries again.
const cache = new Map<string, { history: PriceHistory; loadedAt: number }>();

export function clearPriceHistoryCache() {
  cache.clear();
}

export type PriceHistoryState =
  | { kind: 'loading' }
  | { kind: 'ready'; history: PriceHistory; loadedAt: number }
  | { kind: 'unavailable' };

// `attempt` goes up when the player asks again after a failed load.
export function usePriceHistory(kind: 'resource' | 'item', id: string, serverId: string, enabled: boolean, attempt = 0): PriceHistoryState {
  const key = `${kind}:${id}:${serverId}:${attempt}`;
  const cacheKey = `${kind}:${id}:${serverId}`;
  // The last answer, tagged with the key it answers, so a stale one never shows for another target.
  const [result, setResult] = useState<{ key: string; state: PriceHistoryState }>();

  useEffect(() => {
    if (!enabled || cache.has(cacheKey)) return;
    let cancelled = false;
    void getPriceHistory(kind, id, serverId).then((lookup) => {
      if (cancelled) return;
      if (lookup.status === 'found') {
        const ready = { history: lookup.history, loadedAt: Date.now() };
        cache.set(cacheKey, ready);
        setResult({ key, state: { kind: 'ready', ...ready } });
      } else {
        setResult({ key, state: { kind: 'unavailable' } });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, key, cacheKey, kind, id, serverId]);

  const cached = cache.get(cacheKey);
  if (cached) return { kind: 'ready', ...cached };
  if (result?.key === key) return result.state;
  return { kind: 'loading' };
}
