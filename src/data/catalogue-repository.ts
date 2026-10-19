import manifest from './catalogue-manifest.json';
import { cached, hydrateFromPersistentStore, peekCached } from './catalogue-cache';
import { getDofusDbEffects, getDofusDbInitialItems, getDofusDbItem, getDofusDbItemSet, getDofusDbItemSets, getDofusDbItemTypes, getDofusDbItems, getDofusDbItemsByTypeIds, getDofusDbRecipes, normalizeSearchText } from '../services/dofusdb-api';
import { getDofusDbItemKind, isWeapon, mapDofusDbCategories, mapDofusDbItem, mapDofusDbRecipe, mapDofusDbResource } from '../services/dofusdb-mappers';
import type { Category, ItemStat, Recipe, Resource } from '../domain/types';
import { CHARACTERISTIC_ASSET_BY_ID, ELEMENT_ASSET_BY_ID } from '../domain/characteristic-icons';

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

function getInitialCatalogueItems(): Promise<CatalogueItemIndex> {
  const index = peekCached<CatalogueItemIndex>('catalogue-item-index');
  if (index) return Promise.resolve(index);
  return cached('catalogue-initial-items', async () => ({
    items: await getDofusDbInitialItems(),
  }));
}

function getCatalogueItemIndex(): Promise<CatalogueItemIndex> {
  return cached('catalogue-item-index', async () => ({
    items: await getDofusDbItems(''),
  }));
}

function getCatalogueItemsForSearch(query: string): Promise<CatalogueItemIndex> {
  const index = peekCached<CatalogueItemIndex>('catalogue-item-index');
  if (index) return Promise.resolve(index);
  return cached(`catalogue-query:${normalizeSearchText(query)}`, async () => ({
    items: await getDofusDbItems(query),
  }));
}

function getCatalogueItemsForCategory(query: string, categoryId: string, typeIds: number[]): Promise<CatalogueItemIndex> {
  const index = peekCached<CatalogueItemIndex>('catalogue-item-index');
  if (index) return Promise.resolve(index);
  return cached(`catalogue-category:${categoryId}:${normalizeSearchText(query)}`, async () => ({
    items: await getDofusDbItemsByTypeIds(query, typeIds),
  }));
}

function getItemSetIndex(): Promise<ItemSetIndex> {
  return cached('item-set-index', async () => {
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
  void hydrateFromPersistentStore(['catalogue-item-index', 'item-set-index']).finally(() => {
    void getCatalogueItemIndex();
    void getItemSetIndex();
  });
}

/** Resolves once the full catalogue (all craftable equipment) has finished loading in the
 * background, so callers can tell a capped preview count apart from the real total. */
export function whenCatalogueReady(): Promise<void> {
  return getCatalogueItemIndex().then(() => undefined);
}

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

export async function getItemDetail(id: string, signal?: AbortSignal) {
  const [item, recipes] = await Promise.all([
    cached(`item:${id}`, () => getDofusDbItem(id)),
    cached(`recipes:${id}`, () => getDofusDbRecipes(id)),
  ]);
  const itemSet = typeof item.itemSetId === 'number' && item.itemSetId > 0
    ? await cached(`item-set:${item.itemSetId}`, () => getDofusDbItemSet(item.itemSetId!))
    : undefined;
  const recipeData = recipes[0];
  const stats = await mapItemStats(item, signal);
  const weapon = isWeapon(item);
  if (!recipeData) return { stats, resources: [], panoplieName: itemSet?.name?.fr, isWeapon: weapon };
  const ingredientItems = recipeData.ingredients ?? [];
  const recipe = mapDofusDbRecipe(recipeData, ingredientItems);
  return {
    stats,
    recipe,
    resources: ingredientItems.map(mapDofusDbResource),
    panoplieName: itemSet?.name?.fr,
    isWeapon: weapon,
  };
}

// specs/015-intermediate-craft-costs: the recipe of a resource used as an ingredient. Same source,
// cache key and mapping as an item's own recipe (getItemDetail above), first recipe only. `null`
// when DofusDB has none or returns one that doesn't map — the resource then simply counts as bought
// (FR-012); network errors propagate so the caller can tell "unreachable" from "no recipe".
export async function getResourceRecipe(resourceId: string): Promise<{ recipe: Recipe; resources: Resource[] } | null> {
  const recipes = await cached(`recipes:${resourceId}`, () => getDofusDbRecipes(resourceId));
  const recipeData = recipes[0];
  if (!recipeData) return null;
  try {
    const ingredientItems = recipeData.ingredients ?? [];
    return { recipe: mapDofusDbRecipe(recipeData, ingredientItems), resources: ingredientItems.map(mapDofusDbResource) };
  } catch {
    return null;
  }
}

export async function getResourceDetails(ids: string[]) {
  const items = await Promise.all(
    ids.map((id) => cached(`item:${id}`, () => getDofusDbItem(id))),
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
  const characteristics = new Map(metadata.map((effect) => [effect.id, effect.characteristic]));
  const elements = new Map(metadata.map((effect) => [effect.id, effect.elementId]));
  return effects
    .map((effect, index) => {
      const characteristicId = characteristics.get(effect.effectId!);
      const elementId = elements.get(effect.effectId!);
      // Damage/steal effects report characteristic 0, which coincides with the
      // real "Points de vie" characteristic id: use their element instead. Some of them (e.g.
      // "dommages/vol du meilleur/pire élément") have no fixed element (elementId -1) and use the
      // generic "Dommage" icon in the game's own tooltip instead of an elemental one.
      const icon = characteristicId === 0 && elementId !== undefined
        ? (elementId === -1 ? (effect.category === 2 ? CHARACTERISTIC_ASSET_BY_ID[16] : undefined) : ELEMENT_ASSET_BY_ID[elementId])
        : characteristicId !== undefined ? CHARACTERISTIC_ASSET_BY_ID[characteristicId] : undefined;
      return {
        id: `${effect.effectId}-${index}`,
        label: formatEffectDescription(descriptions.get(effect.effectId!), effect.from!, effect.to!),
        icon,
        positive: effect.from! >= 0 && effect.to! >= 0,
        isWeaponEffect: effect.category === 2,
      };
    })
    .sort((a, b) => Number(!a.positive) - Number(!b.positive));
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

export async function getCategories(): Promise<Category[]> {
  const types = await cached('item-types', () => getDofusDbItemTypes());
  return mapDofusDbCategories(types);
}

// specs/060-page-brisage (FR-002, FR-008): the numeric lines of an item, for the breaking estimate.
// Weapon effects and negative or empty lines can't be broken into runes and are left out; a line
// that rolls between two values keeps its maximum.
export async function getItemEffectLines(id: string): Promise<{ effectId: number; value: number }[]> {
  const item = await cached(`item:${id}`, () => getDofusDbItem(id));
  const lines: { effectId: number; value: number }[] = [];
  for (const effect of item.effects ?? []) {
    if (typeof effect.effectId !== 'number' || typeof effect.from !== 'number' || typeof effect.to !== 'number') continue;
    if (effect.category === 2) continue;
    const value = Math.max(effect.from, effect.to);
    if (value > 0 && effect.from >= 0 && effect.to >= 0) lines.push({ effectId: effect.effectId, value });
  }
  return lines;
}
