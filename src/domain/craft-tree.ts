import type { IngredientChoice, Recipe, RecipeTree, ResourcePrice, RetainedCost } from './types';

// specs/015-intermediate-craft-costs: how each ingredient is counted in a craft cost once its own
// recipe is taken into account. Pure functions over the recipe tree, the active carnet and the
// player's forced choices — nothing here is stored (FR-008).

// Retained cost of one resource at one place in the chain (data-model.md, "Règle de choix").
// `ancestors` holds the resources above it in the current branch: meeting one of them again is a
// cycle, so that occurrence is treated as bought, which is what guarantees termination (FR-012).
export function retainedCost(
  resourceId: string,
  tree: RecipeTree,
  prices: Record<string, ResourcePrice>,
  choices: Record<string, IngredientChoice>,
  ancestors: ReadonlySet<string> = new Set(),
): RetainedCost {
  const purchaseKamas = prices[resourceId]?.unitPriceKamas;
  const recipe = ancestors.has(resourceId) ? undefined : tree.recipes[resourceId];
  if (!recipe) {
    // Not craftable here (no recipe, not loaded yet, or a cycle): the carnet price is all there is,
    // and a forced choice has nothing to choose between.
    return purchaseKamas === undefined
      ? { resourceId, option: 'missing', forced: false }
      : { resourceId, purchaseKamas, option: 'buy', forced: false, unitKamas: purchaseKamas };
  }

  const branch = new Set(ancestors).add(resourceId);
  const children = recipe.ingredients.map((ingredient) => ({
    quantity: ingredient.quantity,
    cost: retainedCost(ingredient.resourceId, tree, prices, choices, branch),
  }));
  const recipeKamas = children.every((child) => child.cost.unitKamas !== undefined)
    ? children.reduce((total, child) => total + child.quantity * (child.cost.unitKamas as number), 0)
    : undefined;

  const forcedChoice = choices[resourceId];
  const base = { resourceId, purchaseKamas, recipeKamas, children, forced: forcedChoice !== undefined };
  if (forcedChoice === 'buy') {
    return purchaseKamas === undefined ? { ...base, option: 'missing' } : { ...base, option: 'buy', unitKamas: purchaseKamas };
  }
  if (forcedChoice === 'craft') {
    return recipeKamas === undefined ? { ...base, option: 'missing' } : { ...base, option: 'craft', unitKamas: recipeKamas };
  }
  if (purchaseKamas !== undefined && (recipeKamas === undefined || purchaseKamas <= recipeKamas)) {
    return { ...base, option: 'buy', unitKamas: purchaseKamas };
  }
  if (recipeKamas !== undefined) return { ...base, option: 'craft', unitKamas: recipeKamas };
  return { ...base, option: 'missing' };
}

// The unit price each top-level ingredient should count for, ready for `compare()` (unchanged):
// its retained cost, or no entry at all when it's missing — which `compare()` already reports as
// a partial craft cost. The final item is an ancestor of the whole chain.
export function effectiveIngredientPrices(
  recipe: Recipe,
  tree: RecipeTree,
  prices: Record<string, ResourcePrice>,
  choices: Record<string, IngredientChoice>,
): Record<string, ResourcePrice> {
  const ancestors = new Set([recipe.itemId]);
  const effective: Record<string, ResourcePrice> = {};
  for (const { resourceId } of recipe.ingredients) {
    const cost = retainedCost(resourceId, tree, prices, choices, ancestors);
    if (cost.unitKamas === undefined) continue;
    effective[resourceId] = {
      resourceId,
      unitPriceKamas: cost.unitKamas,
      // A crafted cost is derived, not a carnet entry: it has no "last updated" date of its own.
      updatedAt: cost.option === 'buy' ? prices[resourceId]?.updatedAt ?? '' : '',
    };
  }
  return effective;
}

// Every resource reachable from `recipe` through the recipes known so far, once each — what the
// carnet has to be read for (and, in Mode communautaire, gap-filled).
export function treeResourceIds(recipe: Recipe, tree: RecipeTree): string[] {
  const seen = new Set<string>();
  const visit = (current: Recipe) => {
    for (const { resourceId } of current.ingredients) {
      if (seen.has(resourceId) || resourceId === recipe.itemId) continue;
      seen.add(resourceId);
      const sub = tree.recipes[resourceId];
      if (sub) visit(sub);
    }
  };
  visit(recipe);
  return [...seen];
}
