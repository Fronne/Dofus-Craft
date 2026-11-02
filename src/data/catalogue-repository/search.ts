import { cached } from '../catalogue-cache';
import { getDofusDbItem, getDofusDbItemTypes, normalizeSearchText } from '../../services/dofusdb-api';
import { getDofusDbItemKind, mapDofusDbCategories, mapDofusDbItem } from '../../services/dofusdb-mappers';
import type { Category } from '../../domain/types';
import { getCatalogueItemIndex, getCatalogueItemsForCategory, getCatalogueItemsForSearch, getInitialCatalogueItems, getItemSetIndex } from './indexes';

export async function searchItems(
  query = '',
  _categoryId = '',
  skip = 0,
  limit = 24,
  _signal?: AbortSignal,
  levelFilter = '',
) {
  const categories = await getCategories();
  const category = categories.find((candidate) => candidate.id === _categoryId);
  if (_categoryId && !category) return { total: 0, limit, skip, data: [] };
  const queryTokens = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  const itemSetIndexPromise = query.trim()
    ? getItemSetIndex()
    : Promise.resolve(undefined);
  const catalogueIndexPromise = category
    ? getCatalogueItemsForCategory(query, category.id, category.typeIds)
    : !query.trim() && !levelFilter
      ? getInitialCatalogueItems()
      : query.trim()
        ? getCatalogueItemsForSearch(query)
        : getCatalogueItemIndex();
  const [catalogueIndex, itemSetIndex] = await Promise.all([
    catalogueIndexPromise,
    itemSetIndexPromise,
  ]);
  const nameItems = catalogueIndex.items.filter((item) => {
    const matchesName = queryTokens.length === 0 ||
      queryTokens.every((token) => normalizeSearchText(item.name?.fr ?? '').includes(token));
    return matchesName && (!_categoryId || itemCategoryMatches(item, _categoryId));
  });
  const itemSets = itemSetIndex?.sets.filter((itemSet) => matchesAllTokens(itemSet.name?.fr ?? '', query)) ?? [];
  const setItems = itemSets
    .flatMap((itemSet) => itemSet.items ?? [])
    .filter((item) => item.hasRecipe !== false);
  const hydratedSetItems = await Promise.all(
    setItems.map((item) => {
      const indexedItem = catalogueIndex.items.find((candidate) => candidate.id === item.id);
      return indexedItem
        ? Promise.resolve(indexedItem)
        : cached(`item:${item.id}`, () => getDofusDbItem(String(item.id)));
    }),
  );
  const allItems = [...new Map([...nameItems, ...hydratedSetItems].map((item) => [item.id, item])).values()];
  const filteredData = allItems.filter((item) => {
    const matchesName = queryTokens.length === 0 ||
      queryTokens.every((token) => normalizeSearchText(item.name?.fr ?? '').includes(token));
    const matchesSet = itemSetIndex?.sets.some((itemSet) =>
      matchesAllTokens(itemSet.name?.fr ?? '', query) &&
      itemSet.items?.some((setItem) => setItem.id === item.id));
    return matchesName || matchesSet;
  });
  const items = filteredData
    .filter((item) => {
      const kind = getDofusDbItemKind(item);
      const matchesCategory = !_categoryId || itemCategoryMatches(item, _categoryId);
      return kind === 'Equipment' && matchesCategory && item.hasRecipe && matchesLevel(item.level, levelFilter);
    })
    .map(mapDofusDbItem)
    .filter((item): item is NonNullable<typeof item> => item !== undefined);
  // Level 200 first, then down to the lowest levels; an item without a level comes last.
  items.sort((left, right) =>
    (right.level ?? Number.NEGATIVE_INFINITY) - (left.level ?? Number.NEGATIVE_INFINITY) ||
    left.name.localeCompare(right.name, 'fr'),
  );
  return {
    total: items.length,
    limit,
    skip,
    data: items.slice(skip, skip + limit),
  };
}

function matchesAllTokens(value: string, query: string): boolean {
  const tokens = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  const normalizedValue = normalizeSearchText(value);
  return tokens.every((token) => normalizedValue.includes(token));
}

function matchesLevel(level: number | undefined, filter: string): boolean {
  if (!filter) return true;
  if (level === undefined) return false;
  if (filter.includes(':')) {
    const [minimumText, maximumText] = filter.split(':');
    const minimum = minimumText ? Number(minimumText) : undefined;
    const maximum = maximumText ? Number(maximumText) : undefined;
    return (minimum === undefined || level >= minimum) &&
      (maximum === undefined || level <= maximum);
  }
  if (filter === '200+') return level >= 200;
  const [minimum, maximum] = filter.split('-').map(Number);
  return level >= minimum && level <= maximum;
}

function itemCategoryMatches(item: Parameters<typeof getDofusDbItemKind>[0], categoryId: string): boolean {
  const mapped = mapDofusDbItem(item);
  return mapped?.categoryId === categoryId;
}

export async function getCategories(): Promise<Category[]> {
  const types = await cached('item-types', () => getDofusDbItemTypes());
  return mapDofusDbCategories(types);
}
