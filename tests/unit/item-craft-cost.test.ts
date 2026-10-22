import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { compare } from '../../src/domain/craft-comparison';
import { effectiveIngredientPrices } from '../../src/domain/craft-tree';
import type { Recipe, RecipeTree, ResourcePrice } from '../../src/domain/types';

const getItemDetail = vi.fn();
const getMany = vi.fn();
vi.mock('../../src/data/catalogue-repository', () => ({ getItemDetail: (id: string) => getItemDetail(id) }));
vi.mock('../../src/features/comparison/recipe-tree-loader', () => ({
  loadRecipeTree: vi.fn().mockResolvedValue({ recipes: {}, resources: {} }),
}));
vi.mock('../../src/persistence/resource-prices-for-mode', () => ({
  resourcePricesFor: () => ({ getMany: (...args: unknown[]) => getMany(...args), save: vi.fn() }),
}));

import { craftCostOf, useItemCraftCost } from '../../src/features/brisage/useItemCraftCost';

// specs/062-prix-objet-brisage: the craft price is the cost of the whole chain, counted as Épingles counts it.
const price = (resourceId: string, unitPriceKamas: number): ResourcePrice => ({ resourceId, unitPriceKamas, updatedAt: '2026-10-20T00:00:00Z' });
const recipe = (itemId: string, ingredients: [string, number][]): Recipe => ({
  id: `r-${itemId}`, itemId, ingredients: ingredients.map(([resourceId, quantity]) => ({ resourceId, quantity })) as Recipe['ingredients'],
});
const emptyTree: RecipeTree = { recipes: {}, resources: {} };

describe('craftCostOf', () => {
  const cape = recipe('cape', [['laine', 3], ['cuir', 2]]);

  it('gives the total of a complete chain, the same as the comparison counts it', () => {
    const prices = { laine: price('laine', 100), cuir: price('cuir', 250) };
    const state = craftCostOf(cape, emptyTree, prices, {});
    expect(state).toEqual({ status: 'ready', costKamas: 800 });
    expect(state.costKamas).toBe(compare(cape, effectiveIngredientPrices(cape, emptyTree, prices, {})).knownCraftCostKamas);
  });

  it('counts a crafted ingredient through its own recipe when it is the cheaper choice', () => {
    const tree: RecipeTree = { recipes: { cuir: recipe('cuir', [['peau', 1]]) }, resources: {} };
    const prices = { laine: price('laine', 100), cuir: price('cuir', 250), peau: price('peau', 10) };
    expect(craftCostOf(cape, tree, prices, { cuir: 'craft' })).toEqual({ status: 'ready', costKamas: 320 });
  });

  it('gives no amount, and says so, when a resource has no price', () => {
    const state = craftCostOf(cape, emptyTree, { laine: price('laine', 100) }, {});
    expect(state).toEqual({ status: 'ready', reason: 'incomplete' });
    expect(state.costKamas).toBeUndefined();
  });

  it('gives no amount for an item without recipe', () => {
    expect(craftCostOf(undefined, emptyTree, {}, {})).toEqual({ status: 'ready', reason: 'no-recipe' });
  });

  it('does not take a zero total as a price', () => {
    const prices = { laine: price('laine', 0), cuir: price('cuir', 0) };
    expect(craftCostOf(cape, emptyTree, prices, {})).toEqual({ status: 'ready', reason: 'incomplete' });
  });
});

// specs/070-atelier-prix-craft-brisage (FR-006): the prices typed in the craft prices window are counted
// once the page asks for a new reading, and only then.
describe('useItemCraftCost reloadKey', () => {
  const cape = recipe('cape', [['laine', 3], ['cuir', 2]]);
  beforeEach(() => {
    getItemDetail.mockReset();
    getMany.mockReset();
    getItemDetail.mockResolvedValue({ recipe: cape, resources: [] });
  });

  it('reads the carnets again when reloadKey changes, and not otherwise', async () => {
    getMany.mockResolvedValue({ laine: price('laine', 100), cuir: price('cuir', 250) });
    const { result, rerender } = renderHook(({ reloadKey }) => useItemCraftCost('mikhal', 'cape', 'personal', reloadKey), { initialProps: { reloadKey: 0 } });
    await waitFor(() => expect(result.current.costKamas).toBe(800));
    expect(getMany).toHaveBeenCalledTimes(1);

    getMany.mockResolvedValue({ laine: price('laine', 200), cuir: price('cuir', 250) });
    rerender({ reloadKey: 0 });
    expect(getMany).toHaveBeenCalledTimes(1);

    rerender({ reloadKey: 1 });
    await waitFor(() => expect(result.current.costKamas).toBe(1100));
    expect(getMany).toHaveBeenCalledTimes(2);
  });
});
