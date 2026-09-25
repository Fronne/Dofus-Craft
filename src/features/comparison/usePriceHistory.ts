import { useEffect, useState } from 'react';
import { getPriceHistory } from '../../services/community-price-api';
import type { PriceHistory } from '../../domain/price-history';

// specs/017-price-history-chart (research.md §6): loaded when a popover opens, then kept in memory for
// the visit — no localStorage, since an old history shown without saying so would mislead. A failed
// load isn't cached, so reopening the popover tries again.
const cache = new Map<string, PriceHistory>();

export function clearPriceHistoryCache() {
  cache.clear();
}

export type PriceHistoryState =
  | { kind: 'loading' }
  | { kind: 'ready'; history: PriceHistory }
  | { kind: 'unavailable' };

export function usePriceHistory(kind: 'resource' | 'item', id: string, serverId: string, enabled: boolean): PriceHistoryState {
  const key = `${kind}:${id}:${serverId}`;
  // The last answer, tagged with the key it answers, so a stale one never shows for another target.
  const [result, setResult] = useState<{ key: string; state: PriceHistoryState }>();

  useEffect(() => {
    if (!enabled || cache.has(key)) return;
    let cancelled = false;
    void getPriceHistory(kind, id, serverId).then((lookup) => {
      if (cancelled) return;
      if (lookup.status === 'found') cache.set(key, lookup.history);
      setResult({ key, state: lookup.status === 'found' ? { kind: 'ready', history: lookup.history } : { kind: 'unavailable' } });
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, key, kind, id, serverId]);

  const cached = cache.get(key);
  if (cached) return { kind: 'ready', history: cached };
  if (result?.key === key) return result.state;
  return { kind: 'loading' };
}
