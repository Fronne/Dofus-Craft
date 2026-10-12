import { useEffect, useState } from 'react';
import type { HdvItemsData } from '../../domain/hdv';

// specs/023-hdv-price-entry (research.md §3): the items of every HDV, frozen in
// src/data/hdv-items.json and loaded on demand so they stay out of the initial bundle. A failed load
// reads as `unavailable`, never as a partial list (FR-011).

export type HdvItemsState =
  | { status: 'loading' }
  | { status: 'ready'; data: HdvItemsData }
  | { status: 'unavailable' };

let loaded: HdvItemsData | undefined;

export function useHdvItems(): HdvItemsState & { retry: () => void } {
  const [state, setState] = useState<HdvItemsState>(() => (loaded ? { status: 'ready', data: loaded } : { status: 'loading' }));
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (loaded) return;
    let cancelled = false;
    setState({ status: 'loading' });
    import('../../data/hdv-items.json')
      .then((module) => {
        loaded = module.default as HdvItemsData;
        if (!cancelled) setState({ status: 'ready', data: loaded });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'unavailable' });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  return { ...state, retry: () => setAttempt((count) => count + 1) };
}
