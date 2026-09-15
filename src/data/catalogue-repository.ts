import manifest from './catalogue-manifest.json';
import { cached, peekCached } from './catalogue-cache';
import { getDofusDbEffects, getDofusDbInitialItems, getDofusDbItem, getDofusDbItemSet, getDofusDbItemSets, getDofusDbItemTypes, getDofusDbItems, getDofusDbRecipes, normalizeSearchText } from '../services/dofusdb-api';
import { getDofusDbItemKind, mapDofusDbCategories, mapDofusDbItem, mapDofusDbRecipe, mapDofusDbResource } from '../services/dofusdb-mappers';
import type { Category, ItemStat } from '../domain/types';

export const getManifest = () => ({
  ...manifest,
  sourceName: 'DofusDB',
  sourceUrl: 'https://api.dofusdb.fr',
});

type ItemSetIndex = {
  sets: Awaited<ReturnType<typeof getDofusDbItemSets>>;
  itemSetIdsByItemId: Map<number, Set<number>>;
};

type CatalogueItemIndex = {
  items: Awaited<ReturnType<typeof getDofusDbItems>>;
};

function getInitialCatalogueItems(signal?: AbortSignal): Promise<CatalogueItemIndex> {
  return cached('catalogue-initial-items', async () => ({
    items: await getDofusDbInitialItems(signal),
  }));
}

function getCatalogueItemIndex(signal?: AbortSignal): Promise<CatalogueItemIndex> {
  return cached('catalogue-item-index', async () => ({
    items: await getDofusDbItems('', signal),
  }));
}

function getCatalogueItemsForSearch(query: string, signal?: AbortSignal): Promise<CatalogueItemIndex> {
  const index = peekCached<CatalogueItemIndex>('catalogue-item-index');
  if (index) return Promise.resolve(index);
  return cached(`catalogue-query:${normalizeSearchText(query)}`, async () => ({
    items: await getDofusDbItems(query, signal),
  }));
}

function getItemSetIndex(signal?: AbortSignal): Promise<ItemSetIndex> {
  return cached('item-set-index', async () => {
    const sets = await getDofusDbItemSets('', signal);
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

export function preloadCatalogueIndexes(signal?: AbortSignal): void {
  void getCatalogueItemIndex(signal);
  void getItemSetIndex(signal);
}

export async function searchItems(
  query = '',
  _categoryId = '',
  skip = 0,
  limit = 24,
  signal?: AbortSignal,
  levelFilter = '',
) {
  const categories = await getCategories(signal);
  const category = categories.find((candidate) => candidate.id === _categoryId);
  if (_categoryId && !category) return { total: 0, limit, skip, data: [] };
  const queryTokens = normalizeSearchText(query).split(/\s+/).filter(Boolean);
  const itemSetIndexPromise = query.trim()
    ? getItemSetIndex(signal)
    : Promise.resolve(undefined);
  const catalogueIndexPromise = !query.trim() && !_categoryId && !levelFilter
    ? getInitialCatalogueItems(signal)
    : query.trim()
      ? getCatalogueItemsForSearch(query, signal)
      : getCatalogueItemIndex(signal);
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
        : cached(`item:${item.id}`, () => getDofusDbItem(String(item.id), signal));
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
  items.sort((left, right) =>
    (left.level ?? Number.POSITIVE_INFINITY) - (right.level ?? Number.POSITIVE_INFINITY) ||
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

export async function getItemDetail(id: string, signal?: AbortSignal) {
  const [item, recipes] = await Promise.all([
    cached(`item:${id}`, () => getDofusDbItem(id, signal)),
    cached(`recipes:${id}`, () => getDofusDbRecipes(id, signal)),
  ]);
  const itemSet = typeof item.itemSetId === 'number' && item.itemSetId > 0
    ? await cached(`item-set:${item.itemSetId}`, () => getDofusDbItemSet(item.itemSetId!, signal))
    : undefined;
  const recipeData = recipes[0];
  const stats = await mapItemStats(item, signal);
  if (!recipeData) return { stats, resources: [], panoplieName: itemSet?.name?.fr };
  const ingredientItems = recipeData.ingredients ?? [];
  const recipe = mapDofusDbRecipe(recipeData, ingredientItems);
  return {
    stats,
    recipe,
    resources: ingredientItems.map(mapDofusDbResource),
    panoplieName: itemSet?.name?.fr,
  };
}

export async function getResourceDetails(ids: string[], signal?: AbortSignal) {
  const items = await Promise.all(
    ids.map((id) => cached(`item:${id}`, () => getDofusDbItem(id, signal))),
  );
  return items.map(mapDofusDbResource);
}

async function mapItemStats(
  item: Awaited<ReturnType<typeof getDofusDbItem>>,
  signal?: AbortSignal,
): Promise<ItemStat[]> {
  const effects = (item.effects ?? []).filter((effect) =>
    typeof effect.effectId === 'number' && typeof effect.from === 'number' && typeof effect.to === 'number');
  if (!effects.length) return [];
  const metadata = await getDofusDbEffects(
    [...new Set(effects.map((effect) => effect.effectId!))],
    signal,
  );
  const descriptions = new Map(metadata.map((effect) => [effect.id, effect.description?.fr]));
  return effects.map((effect, index) => ({
    id: `${effect.effectId}-${index}`,
    label: formatEffectDescription(descriptions.get(effect.effectId!), effect.from!, effect.to!),
  }));
}

function formatEffectDescription(template: string | undefined, from: number, to: number): string {
  const values = getDisplayedEffectValues(from, to);
  if (!template) {
    return values.fixed
      ? `Effet ${values.minimum}`
      : `Effet ${values.minimum} à ${values.maximum}`;
  }
  const formatted = template
    .replace(/\{\{~1~2([^}]*)\}\}/g, values.fixed ? '' : '$1')
    .replace(/#1/g, values.fixed ? '' : String(values.minimum))
    .replace(/#2/g, String(values.maximum))
    .replace(/\{\{~[^}]*\}\}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/--/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  return formatted;
}

function getDisplayedEffectValues(from: number, to: number): {
  minimum: number;
  maximum: number;
  fixed: boolean;
} {
  if (from === to) return { minimum: from, maximum: to, fixed: true };
  if (to === 0) return { minimum: from, maximum: from, fixed: true };
  if (from === 0) return { minimum: to, maximum: to, fixed: true };
  return { minimum: from, maximum: to, fixed: false };
}

export async function getCategories(signal?: AbortSignal): Promise<Category[]> {
  const types = await cached('item-types', () => getDofusDbItemTypes(signal));
  return mapDofusDbCategories(types);
}
