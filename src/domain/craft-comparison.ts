import type { Comparison, Recipe, ResourcePrice } from './types';

export function compare(
  recipe: Recipe,
  prices: Record<string, ResourcePrice>,
  marketPrice?: number,
): Comparison {
  const lines: Comparison['lines'] = recipe.ingredients.map((ingredient) => {
    const price = prices[ingredient.resourceId];
    return price
      ? {
          ...ingredient,
          unitPriceKamas: price.unitPriceKamas,
          subtotalKamas: ingredient.quantity * price.unitPriceKamas,
        }
      : { ...ingredient };
  });
  const missing = lines
    .filter((line) => line.unitPriceKamas === undefined)
    .map((line) => line.resourceId);
  const known = lines.reduce(
    (total, line) => total + (line.subtotalKamas ?? 0),
    0,
  );
  const base = {
    lines,
    knownCraftCostKamas: known,
    missingResourceIds: missing,
    craftCostStatus: missing.length ? 'partial' : 'complete',
  } as const;

  if (missing.length || marketPrice === undefined) {
    return {
      ...base,
      marketPriceKamas: marketPrice,
      recommendation: 'insufficient-data',
    };
  }
  if (known === marketPrice) {
    return {
      ...base,
      marketPriceKamas: marketPrice,
      recommendation: 'equal',
      differenceKamas: 0,
    };
  }
  if (known < marketPrice) {
    const difference = marketPrice - known;
    return {
      ...base,
      marketPriceKamas: marketPrice,
      recommendation: 'craft',
      differenceKamas: difference,
      percentage: marketPrice ? (difference / marketPrice) * 100 : undefined,
      percentageBase: marketPrice ? 'market-price' : undefined,
    };
  }
  const difference = known - marketPrice;
  return {
    ...base,
    marketPriceKamas: marketPrice,
    recommendation: 'buy',
    differenceKamas: difference,
    percentage: known ? (difference / known) * 100 : undefined,
    percentageBase: known ? 'craft-cost' : undefined,
  };
}
