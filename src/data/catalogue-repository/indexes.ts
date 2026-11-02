import { cached, hydrateFromPersistentStore, peekCached } from '../catalogue-cache';
import { loadCatalogueSnapshot, refreshCatalogueIfChanged } from '../catalogue-snapshot';
import { getDofusDbInitialItems, getDofusDbItemSets, getDofusDbItems, getDofusDbItemsByTypeIds, normalizeSearchText } from '../../services/dofusdb-api';

export type ItemSetIndex = {
  sets: Awaited<ReturnType<typeof getDofusDbItemSets>>;
  itemSetIdsByItemId: Map<number, Set<number>>;
};

export type CatalogueItemIndex = {
  items: Awaited<ReturnType<typeof getDofusDbItems>>;
};

export function getInitialCatalogueItems(): Promise<CatalogueItemIndex> {
  const index = peekCached<CatalogueItemIndex>('catalogue-item-index');
  if (index) return Promise.resolve(index);
  return cached('catalogue-initial-items', async () => ({
    items: await getDofusDbInitialItems(),
  }));
}

export function getCatalogueItemIndex(): Promise<CatalogueItemIndex> {
  return cached('catalogue-item-index', async () => {
    // specs/072: the shipped snapshot fills the index; the crawl is only the fallback.
    await loadCatalogueSnapshot();
    return peekCached<CatalogueItemIndex>('catalogue-item-index') ?? { items: await getDofusDbItems('') };
  });
}

export function getCatalogueItemsForSearch(query: string): Promise<CatalogueItemIndex> {
  const index = peekCached<CatalogueItemIndex>('catalogue-item-index');
  if (index) return Promise.resolve(index);
  return cached(`catalogue-query:${normalizeSearchText(query)}`, async () => ({
    items: await getDofusDbItems(query),
  }));
}

export function getCatalogueItemsForCategory(query: string, categoryId: string, typeIds: number[]): Promise<CatalogueItemIndex> {
  const index = peekCached<CatalogueItemIndex>('catalogue-item-index');
  if (index) return Promise.resolve(index);
  return cached(`catalogue-category:${categoryId}:${normalizeSearchText(query)}`, async () => ({
    items: await getDofusDbItemsByTypeIds(query, typeIds),
  }));
}

export function getItemSetIndex(): Promise<ItemSetIndex> {
  return cached('item-set-index', async () => {
    await loadCatalogueSnapshot();
    const seeded = peekCached<ItemSetIndex>('item-set-index');
    if (seeded) return seeded;
    const sets = await getDofusDbItemSets('');
    const itemSetIdsByItemId = new Map<number, Set<number>>();
    sets.forEach((itemSet) => {
      itemSet.items?.forEach((item) => {
        const setIds = itemSetIdsByItemId.get(item.id) ?? new Set<number>();
        setIds.add(itemSet.id);
        itemSetIdsByItemId.set(item.id, setIds);
      });
    });
    return { sets, itemSetIdsByItemId };
  });
}

export function preloadCatalogueIndexes(): void {
  // specs/021-background-data-loading (SC-001): the indexes kept on the device from a previous visit
  // go into memory first, so the search's synchronous "full index ready?" checks see them at once.
  // specs/072: then the shipped snapshot (or a more recent kept copy) fills them without crawling.
  void hydrateFromPersistentStore(['catalogue-item-index', 'item-set-index']).finally(() => {
    void loadCatalogueSnapshot().then((ready) => {
      if (ready) return refreshCatalogueIfChanged();
      void getCatalogueItemIndex();
      void getItemSetIndex();
      return undefined;
    });
  });
}

/** Resolves once the full catalogue (all craftable equipment) has finished loading in the
 * background, so callers can tell a capped preview count apart from the real total. */
export function whenCatalogueReady(): Promise<void> {
  return getCatalogueItemIndex().then(() => undefined);
}
