import { useEffect, useState } from 'react';
import { searchItems } from '../../data/catalogue-repository';
import type { Item } from '../../domain/types';

// specs/027-fm-item-recap (FR-001): the catalogue's equipment matching a name — the same search as the
// Recherche page, equipment only. specs/031 (research R5): shared with the session's item search.

export const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;
const MAX_RESULTS = 10;

export type EquipmentSearch = { status: 'idle' | 'searching' | 'unavailable' } | { status: 'ready'; items: Item[] };

export function useEquipmentSearch(query: string): EquipmentSearch {
  const [state, setState] = useState<EquipmentSearch>({ status: 'idle' });

  useEffect(() => {
    if (query.trim().length < MIN_QUERY_LENGTH) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setState({ status: 'searching' });
      searchItems(query, '', 0, 40)
        .then((result) => {
          if (!cancelled) setState({ status: 'ready', items: result.data.filter((item) => item.kind === 'Equipment').slice(0, MAX_RESULTS) });
        })
        .catch(() => {
          if (!cancelled) setState({ status: 'unavailable' });
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  return query.trim().length < MIN_QUERY_LENGTH ? { status: 'idle' } : state;
}
