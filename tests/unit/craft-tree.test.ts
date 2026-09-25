import { describe, expect, it } from 'vitest';
import { effectiveIngredientPrices, retainedCost, treeResourceIds } from '../../src/domain/craft-tree';
import type { Recipe, RecipeTree, ResourcePrice } from '../../src/domain/types';

// Dagues de Fouraille (item 208): 2 × Planche Agglomérée (16489, craftable) + 3 × Peau (362).
// Planche Agglomérée: 10 × Bois de Frêne (303).
const DAGUES: Recipe = { id: '208', itemId: '208', ingredients: [{ resourceId: '16489', quantity: 2 }, { resourceId: '362', quantity: 3 }] };
const PLANCHE: Recipe = { id: '16489', itemId: '16489', ingredients: [{ resourceId: '303', quantity: 10 }] };

function tree(recipes: RecipeTree['recipes']): RecipeTree {
  return { recipes, resources: {} };
}

function prices(values: Record<string, number>): Record<string, ResourcePrice> {
  return Object.fromEntries(Object.entries(values).map(([resourceId, unitPriceKamas]) =>
    [resourceId, { resourceId, unitPriceKamas, updatedAt: '2026-09-25T10:00:00.000Z' }]));
}

const PLANCHE_TREE = tree({ '16489': PLANCHE, '362': null, '303': null });

describe('retainedCost (specs/015 contracts/craft-tree.md)', () => {
  it('counts a non-craftable resource at its carnet price', () => {
    const cost = retainedCost('362', PLANCHE_TREE, prices({ '362': 100 }), {});
    expect(cost).toMatchObject({ option: 'buy', unitKamas: 100, forced: false });
    expect(cost.children).toBeUndefined();
  });

  it('keeps the recipe when it is cheaper than buying', () => {
    const cost = retainedCost('16489', PLANCHE_TREE, prices({ '16489': 5000, '303': 200 }), {});
    expect(cost).toMatchObject({ option: 'craft', purchaseKamas: 5000, recipeKamas: 2000, unitKamas: 2000, forced: false });
  });

  it('keeps buying when it is cheaper than the recipe', () => {
    const cost = retainedCost('16489', PLANCHE_TREE, prices({ '16489': 5000, '303': 600 }), {});
    expect(cost).toMatchObject({ option: 'buy', recipeKamas: 6000, unitKamas: 5000 });
  });

  it('buys on a tie', () => {
    const cost = retainedCost('16489', PLANCHE_TREE, prices({ '16489': 2000, '303': 200 }), {});
    expect(cost).toMatchObject({ option: 'buy', unitKamas: 2000 });
  });

  it('uses the only known value', () => {
    expect(retainedCost('16489', PLANCHE_TREE, prices({ '16489': 5000 }), {})).toMatchObject({ option: 'buy', unitKamas: 5000 });
    expect(retainedCost('16489', PLANCHE_TREE, prices({ '303': 200 }), {})).toMatchObject({ option: 'craft', unitKamas: 2000 });
  });

  it('is missing when neither value is known', () => {
    const cost = retainedCost('16489', PLANCHE_TREE, prices({}), {});
    expect(cost.option).toBe('missing');
    expect(cost.unitKamas).toBeUndefined();
  });

  it('leaves the recipe cost undefined while a sub-resource has no price', () => {
    const recipe: Recipe = { id: 'x', itemId: 'x', ingredients: [{ resourceId: 'a', quantity: 1 }, { resourceId: 'b', quantity: 2 }] };
    const cost = retainedCost('x', tree({ x: recipe, a: null, b: null }), prices({ x: 900, a: 10 }), {});
    expect(cost.recipeKamas).toBeUndefined();
    expect(cost).toMatchObject({ option: 'buy', unitKamas: 900 });
  });

  it('reports a forced "buy" with no purchase price as missing, never falling back to the recipe', () => {
    const cost = retainedCost('16489', PLANCHE_TREE, prices({ '303': 200 }), { '16489': 'buy' });
    expect(cost).toMatchObject({ option: 'missing', forced: true, recipeKamas: 2000 });
    expect(cost.unitKamas).toBeUndefined();
  });

  it('honours a forced "craft" even when buying is cheaper', () => {
    const cost = retainedCost('16489', PLANCHE_TREE, prices({ '16489': 5000, '303': 600 }), { '16489': 'craft' });
    expect(cost).toMatchObject({ option: 'craft', forced: true, unitKamas: 6000 });
  });

  it('carries costs up a three-level chain, multiplying quantities at each level', () => {
    const top: Recipe = { id: 'top', itemId: 'top', ingredients: [{ resourceId: 'mid', quantity: 2 }] };
    const mid: Recipe = { id: 'mid', itemId: 'mid', ingredients: [{ resourceId: 'leaf', quantity: 3 }] };
    const leaf: Recipe = { id: 'leaf', itemId: 'leaf', ingredients: [{ resourceId: 'ore', quantity: 4 }] };
    const chain = tree({ top, mid, leaf, ore: null });
    const cost = retainedCost('top', chain, prices({ ore: 5 }), {});
    // ore 5 → leaf 20 → mid 60 → top 120
    expect(cost).toMatchObject({ option: 'craft', unitKamas: 120 });
    expect(cost.children?.[0]).toMatchObject({ quantity: 2, cost: { resourceId: 'mid', unitKamas: 60 } });
    expect(cost.children?.[0].cost.children?.[0]).toMatchObject({ quantity: 3, cost: { resourceId: 'leaf', unitKamas: 20 } });
  });

  it('terminates on a cycle, treating the repeated resource as bought', () => {
    const a: Recipe = { id: 'a', itemId: 'a', ingredients: [{ resourceId: 'b', quantity: 1 }] };
    const b: Recipe = { id: 'b', itemId: 'b', ingredients: [{ resourceId: 'a', quantity: 1 }] };
    const cost = retainedCost('a', tree({ a, b }), prices({ a: 50 }), {});
    const nestedA = cost.children?.[0].cost.children?.[0].cost;
    expect(nestedA).toMatchObject({ resourceId: 'a', option: 'buy', unitKamas: 50 });
    expect(nestedA?.children).toBeUndefined();
    expect(cost).toMatchObject({ option: 'buy', unitKamas: 50 });
  });

  it('treats a recipe not loaded yet as bought, then uses it once loaded', () => {
    const values = prices({ '16489': 5000, '303': 200 });
    expect(retainedCost('16489', tree({}), values, {})).toMatchObject({ option: 'buy', unitKamas: 5000 });
    expect(retainedCost('16489', PLANCHE_TREE, values, {})).toMatchObject({ option: 'craft', unitKamas: 2000 });
  });

  it('does not mutate its inputs', () => {
    const values = prices({ '16489': 5000, '303': 200 });
    const snapshot = JSON.stringify([PLANCHE_TREE, values]);
    retainedCost('16489', PLANCHE_TREE, values, {});
    expect(JSON.stringify([PLANCHE_TREE, values])).toBe(snapshot);
  });
});

describe('effectiveIngredientPrices', () => {
  it('gives each top-level ingredient its retained unit cost, and leaves missing ones out', () => {
    const effective = effectiveIngredientPrices(DAGUES, PLANCHE_TREE, prices({ '16489': 5000, '303': 200 }), {});
    expect(effective['16489']).toMatchObject({ resourceId: '16489', unitPriceKamas: 2000, updatedAt: '' });
    expect(effective['362']).toBeUndefined();
  });

  it('keeps the carnet date for a bought ingredient', () => {
    const effective = effectiveIngredientPrices(DAGUES, PLANCHE_TREE, prices({ '16489': 5000, '303': 600, '362': 100 }), {});
    expect(effective['16489']).toMatchObject({ unitPriceKamas: 5000, updatedAt: '2026-09-25T10:00:00.000Z' });
    expect(effective['362']).toMatchObject({ unitPriceKamas: 100 });
  });

  it('never expands the final item itself if it shows up in its own chain', () => {
    const loop: Recipe = { id: '16489', itemId: '16489', ingredients: [{ resourceId: '208', quantity: 1 }] };
    const effective = effectiveIngredientPrices(DAGUES, tree({ '16489': loop, '208': { ...DAGUES } }), prices({ '208': 7, '16489': 999 }), {});
    expect(effective['16489']).toMatchObject({ unitPriceKamas: 7 });
  });
});

describe('treeResourceIds', () => {
  it('lists every reachable resource once, following known recipes only', () => {
    const shared: Recipe = { id: 'r', itemId: 'r', ingredients: [{ resourceId: '303', quantity: 1 }, { resourceId: '16489', quantity: 1 }] };
    const recipe: Recipe = { id: 'i', itemId: 'i', ingredients: [{ resourceId: '16489', quantity: 1 }, { resourceId: 'r', quantity: 1 }] };
    const ids = treeResourceIds(recipe, tree({ '16489': PLANCHE, r: shared, '303': null }));
    expect(ids.sort()).toEqual(['16489', '303', 'r']);
  });
});
