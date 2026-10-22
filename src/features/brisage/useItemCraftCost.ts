import { useEffect, useState } from 'react';
import { getItemDetail } from '../../data/catalogue-repository';
import { compare } from '../../domain/craft-comparison';
import { effectiveIngredientPrices, treeResourceIds } from '../../domain/craft-tree';
import type { PriceMode } from '../../domain/price-modes';
import { getIngredientChoices } from '../../persistence/ingredient-choices';
import { resourcePricesFor } from '../../persistence/resource-prices-for-mode';
import type { IngredientChoice, Recipe, RecipeTree, ResourcePrice } from '../../domain/types';
import { syncCommunityPrices } from '../comparison/community-gap-fill';
import { loadRecipeTree } from '../comparison/recipe-tree-loader';

// specs/062-prix-objet-brisage (FR-004, FR-005): the craft price of the item is the cost of its whole
// craft chain, counted exactly as the Épingles page counts it — same recipe tree, same carnet of resource
// prices (the device's own in Mode personnel, the group's in Mode communautaire), same forced choices.
// A chain with a missing price or no recipe gives no amount: nothing is guessed.

export type ItemCraftCostState = {
  status: 'loading' | 'ready';
  costKamas?: number;
  /** Why there is no amount once `ready`. */
  reason?: 'incomplete' | 'no-recipe';
};

const LOADING: ItemCraftCostState = { status: 'loading' };

/** The pure part: the chain's cost from a loaded tree and the carnet. A zero or negative total is no price. */
export function craftCostOf(
  recipe: Recipe | undefined,
  tree: RecipeTree,
  prices: Record<string, ResourcePrice>,
  choices: Record<string, IngredientChoice>,
): ItemCraftCostState {
  if (!recipe) return { status: 'ready', reason: 'no-recipe' };
  const result = compare(recipe, effectiveIngredientPrices(recipe, tree, prices, choices));
  if (result.craftCostStatus !== 'complete') return { status: 'ready', reason: 'incomplete' };
  return result.knownCraftCostKamas > 0
    ? { status: 'ready', costKamas: result.knownCraftCostKamas }
    : { status: 'ready', reason: 'incomplete' };
}

async function loadCraftCost(
  serverId: string,
  itemId: string,
  priceMode: PriceMode,
  isCancelled: () => boolean,
  publish: (state: ItemCraftCostState) => void,
): Promise<void> {
  const detail = await getItemDetail(itemId);
  if (isCancelled()) return;
  if (!detail.recipe) return publish({ status: 'ready', reason: 'no-recipe' });
  const tree = await loadRecipeTree(detail.recipe, detail.resources);
  if (isCancelled()) return;
  const choices = getIngredientChoices();
  const repository = resourcePricesFor(priceMode);
  const resourceIds = treeResourceIds(detail.recipe, tree);
  const prices: Record<string, ResourcePrice> = await repository.getMany(serverId, resourceIds);
  if (isCancelled()) return;
  publish(craftCostOf(detail.recipe, tree, prices, choices));
  // Mode communautaire: bring in the group's latest shared prices as Épingles does, after the carnet
  // values are already on screen, so a slow network never delays them.
  if (priceMode !== 'community') return;
  await syncCommunityPrices(serverId, resourceIds, prices, (resourceId, amountKamas, updatedAt) => repository.save(serverId, resourceId, amountKamas, updatedAt), isCancelled);
  if (!isCancelled()) publish(craftCostOf(detail.recipe, tree, prices, choices));
}

// specs/070-atelier-prix-craft-brisage: `reloadKey` is bumped when the craft prices window closes, so the
// carnets are read again and the prices typed there are counted.
export function useItemCraftCost(serverId: string | undefined, itemId: string | undefined, priceMode: PriceMode, reloadKey = 0): ItemCraftCostState {
  const key = serverId && itemId ? `${serverId}:${itemId}:${priceMode}:${reloadKey}` : undefined;
  const [loaded, setLoaded] = useState<{ key: string; state: ItemCraftCostState }>();
  useEffect(() => {
    if (!serverId || !itemId || !key) return;
    let cancelled = false;
    loadCraftCost(serverId, itemId, priceMode, () => cancelled, (state) => { if (!cancelled) setLoaded({ key, state }); })
      // Never left on « loading »: a failure reads as « incomplete », and the player can type the price.
      .catch(() => { if (!cancelled) setLoaded({ key, state: { status: 'ready', reason: 'incomplete' } }); });
    return () => { cancelled = true; };
  }, [key, serverId, itemId, priceMode]);
  return loaded && loaded.key === key ? loaded.state : LOADING;
}
