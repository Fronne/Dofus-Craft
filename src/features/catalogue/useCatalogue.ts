import { useEffect, useState } from 'react';
import { getCategories, getItemDetail, searchItems, whenCatalogueReady } from '../../data/catalogue-repository';
import { useStaleWhileRevalidate } from '../../data/use-stale-while-revalidate';
import { catalogueCache } from '../../persistence/indexeddb-catalogue-cache-store';
import type { Category, Item, ItemStat, Recipe, Resource } from '../../domain/types';

type SearchPage = { total: number; limit: number; skip: number; data: Item[] };
type DetailResult = { recipe?: Recipe; resources: Resource[]; stats?: ItemStat[]; panoplieName?: string };

function loadCached<T>(key: string): Promise<{ value: T; savedAt: string } | undefined> {
  return catalogueCache.get(key).then((entry) => entry && { value: entry.value as T, savedAt: entry.savedAt });
}

function saveCache<T>(key: string, value: T): Promise<string> {
  return catalogueCache.set(key, value);
}

// specs/010-search-instant-cache, FR-007/T014: only surface a blocking error message when there is
// genuinely nothing else to show (first visit, no cache) — once a cache-derived or previously
// fetched value is already displayed, a failed revalidation must only flip `offline`, never
// re-introduce a blocking `error`/`detailError` string over data that's still perfectly usable.
function blockingErrorMessage(hasData: boolean, error: unknown, fallback: string): string {
  if (hasData || !error) return '';
  return error instanceof Error ? error.message : fallback;
}

export function useCatalogue(query: string, categoryId: string, selectedId: string, levelFilter = '', resultLimit = 12) {
  const [catalogueWarm, setCatalogueWarm] = useState(false);
  useEffect(() => {
    let cancelled = false;
    whenCatalogueReady().then(() => {
      if (!cancelled) setCatalogueWarm(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const categoriesState = useStaleWhileRevalidate<Category[]>({
    key: 'categories',
    loadCached,
    fetchRemote: () => getCategories(),
    saveCache,
  });

  // Same 250ms debounce as before, applied to the *key* fed to useStaleWhileRevalidate rather than
  // to a direct call — the underlying hook itself has no debounce concept, it just reacts to key
  // changes. `catalogueWarm` stays a dependency so the delayed refetch below can still fire once
  // the background full catalogue load finishes, matching the pre-existing "silent refetch once
  // warm" behavior (see whenCatalogueReady's docstring in catalogue-repository.ts).
  const currentSearchKey = `search:${query}:${categoryId}:${levelFilter}:${resultLimit}`;
  const [debouncedSearchKey, setDebouncedSearchKey] = useState(currentSearchKey);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchKey(currentSearchKey), 250);
    return () => window.clearTimeout(timer);
  }, [currentSearchKey]);

  const searchState = useStaleWhileRevalidate<SearchPage>({
    key: debouncedSearchKey,
    loadCached,
    fetchRemote: () => searchItems(query, categoryId, 0, resultLimit, undefined, levelFilter),
    saveCache,
    // Bumping this once catalogueWarm flips true forces one extra revalidation of the *same*
    // search key (preview total -> real total) without resetting the already-displayed results to
    // a loading state — unlike an actual new key (a genuinely different query/filter).
    revalidateToken: catalogueWarm ? 1 : 0,
  });

  const detailKey = selectedId ? `detail:${selectedId}` : undefined;
  const detailState = useStaleWhileRevalidate<DetailResult>({
    key: detailKey,
    loadCached,
    fetchRemote: () => getItemDetail(selectedId),
    saveCache,
  });

  return {
    items: searchState.data?.data ?? [],
    total: searchState.data?.total ?? 0,
    loading: searchState.loading,
    // False while the displayed results still belong to a previous search (debounce pending or
    // still loading): "the selected item isn't among the results" means nothing until then.
    resultsMatchQuery: debouncedSearchKey === currentSearchKey && !searchState.loading,
    error: blockingErrorMessage(searchState.data !== undefined, searchState.error, 'Impossible de charger les objets.'),
    detail: detailState.data,
    detailLoading: detailState.loading,
    detailError: blockingErrorMessage(detailState.data !== undefined, detailState.error, 'Impossible de charger la recette.'),
    categories: categoriesState.data ?? [],
    catalogueWarm,
    isRevalidating: searchState.isRevalidating || detailState.isRevalidating || categoriesState.isRevalidating,
    offline: searchState.offline || detailState.offline || categoriesState.offline,
    lastSyncedAt: searchState.lastSyncedAt,
  };
}
