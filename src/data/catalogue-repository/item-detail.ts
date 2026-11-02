import { cached } from '../catalogue-cache';
import { getDofusDbItem, getDofusDbItemSet, getDofusDbRecipes } from '../../services/dofusdb-api';
import { isWeapon, mapDofusDbRecipe, mapDofusDbResource } from '../../services/dofusdb-mappers';
import type { Recipe, Resource } from '../../domain/types';
import { mapItemStats } from './effects';

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
