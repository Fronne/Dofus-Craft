import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RESULTS_PAGE_SIZE } from '../catalogue/ItemResults';

const SEARCH_CONTEXT_STORAGE_KEY = 'craftcheck-recherche-context';

// The search context of the Recherche page: the query, the filters, the page size and the chosen
// item, carried by the URL (deep links) and kept across navigation in sessionStorage.
export function useRechercheUrlState() {
  const [searchParams, setSearchParams] = useSearchParams();
  // react-router-dom's `navigate()` (which `setSearchParams` calls under the hood) is async — it
  // goes through the data router's own navigation queue, so `window.location.search` isn't
  // guaranteed to reflect a call's effect by the time a *second* call happens right after it.
  // Combined with `setSearchParams`'s functional updater also not being a true functional update
  // (it calls back with `searchParams` captured in a `useCallback` closure from the last render,
  // not the latest pending value), two `updateParams` calls issued close together — e.g. a
  // keystroke's own `setQuery` and RecherchePage's "auto-select the first result" effect calling
  // `setSelected` right after a catalogue update — can each build on a stale base, and whichever
  // navigation lands last silently overwrites the other's change (a dropped character while
  // typing, per user report — specs/010-search-instant-cache made a catalogue update land during
  // typing more often, by fetching search results twice per query, cache then network, instead of
  // once). `pendingParamsRef` tracks the latest *intended* params synchronously across calls, so
  // each one always builds on top of every prior call's patch, regardless of when the
  // corresponding navigation actually resolves. Multiple in-flight navigations aren't guaranteed
  // to resolve in the order they were issued, either — so this is only ever cleared once
  // `searchParams` (the router's committed value) actually matches what we last intended, never
  // just because it changed (an out-of-order resolution of an older, already-superseded call would
  // otherwise clear it prematurely, right back into the same race).
  const pendingParamsRef = useRef<URLSearchParams | null>(null);
  useEffect(() => {
    if (pendingParamsRef.current && searchParams.toString() === pendingParamsRef.current.toString()) {
      pendingParamsRef.current = null;
    }
  }, [searchParams]);
  const updateParams = (patch: Record<string, string | undefined>) => {
    const base = pendingParamsRef.current ?? searchParams;
    const next = new URLSearchParams(base);
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || value === '') next.delete(key);
      else next.set(key, value);
    }
    pendingParamsRef.current = next;
    setSearchParams(next, { replace: true });
  };
  // The search text field is typed fast enough that a fully URL-controlled value can get reset to
  // a stale snapshot mid-typing: react-router-dom's navigate() is async and doesn't guarantee that
  // two in-flight navigations (this field's own update and, e.g., RecherchePage's "auto-select the
  // first result" effect calling setSelected right after a catalogue update) resolve in the order
  // they were issued. `query` is local state instead — always the latest typed value immediately,
  // never rewound by an unrelated navigation resolving late (confirmed by live-browser reproduction
  // of dropped characters while typing, and by `pendingParamsRef` above alone not being enough to
  // fix it). It's still pushed to the URL below for deep-linking / the sessionStorage restore, just
  // never read back from there except at the two explicit, imperative points that legitimately
  // want to replace it outright: the session-restore effect and `resetFilters`.
  const [query, setQueryDraft] = useState(() => searchParams.get('q') ?? '');
  const setQuery = (value: string) => {
    setQueryDraft(value);
    updateParams({ q: value, limit: undefined });
  };
  // Nav-link clicks land on the bare route (no query string), so a plain URL-only search
  // context would be lost every time the user leaves Recherche and comes back. Restore it
  // from sessionStorage in that case; an explicit deep link (e.g. ?item=X from Épinglés or
  // Prix) is left untouched since the URL already carries intentional state.
  useEffect(() => {
    if (searchParams.toString()) return;
    try {
      const stored = window.sessionStorage.getItem(SEARCH_CONTEXT_STORAGE_KEY);
      if (!stored) return;
      const restored = new URLSearchParams(stored);
      if ([...restored.keys()].length > 0) {
        // Recorded as the intended params right away, so effects running in this same commit
        // (the auto-select below) see the restored item instead of the still-empty URL.
        pendingParamsRef.current = restored;
        setSearchParams(restored, { replace: true });
        setQueryDraft(restored.get('q') ?? '');
      }
    } catch {
      // sessionStorage unavailable (private browsing, etc.) — nothing to restore.
    }
  }, []);
  useEffect(() => {
    try {
      window.sessionStorage.setItem(SEARCH_CONTEXT_STORAGE_KEY, searchParams.toString());
    } catch {
      // sessionStorage unavailable — the search context just won't survive navigation.
    }
  }, [searchParams]);
  const category = searchParams.get('category') ?? '';
  const levelMin = searchParams.get('levelMin') ?? '';
  const levelMax = searchParams.get('levelMax') ?? '';
  const resultLimit = Number(searchParams.get('limit')) || RESULTS_PAGE_SIZE;
  const selected = searchParams.get('item') ?? '';
  // A new search starts back at one page of results rather than keeping however many « Afficher
  // plus » clicks the previous one had.
  const setCategory = (value: string) => updateParams({ category: value, limit: undefined });
  const setLevelMin = (value: string) => updateParams({ levelMin: value, limit: undefined });
  const setLevelMax = (value: string) => updateParams({ levelMax: value, limit: undefined });
  const setResultLimit = (value: number) => updateParams({ limit: String(value) });
  const setSelected = (id: string) => updateParams({ item: id });
  const resetFilters = () => {
    setQueryDraft('');
    updateParams({ q: undefined, category: undefined, levelMin: undefined, levelMax: undefined, limit: undefined });
  };

  return {
    pendingParamsRef,
    query, setQuery,
    category, setCategory,
    levelMin, setLevelMin,
    levelMax, setLevelMax,
    resultLimit, setResultLimit,
    selected, setSelected,
    resetFilters,
  };
}
