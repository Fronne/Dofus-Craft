import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Recipe, Resource } from '../../src/domain/types';

const getResourceRecipe = vi.fn<(id: string) => Promise<{ recipe: Recipe; resources: Resource[] } | null>>();
vi.mock('../../src/data/catalogue-repository', () => ({
  getResourceRecipe: (id: string) => getResourceRecipe(id),
}));

import { loadRecipeTree } from '../../src/features/comparison/recipe-tree-loader';

const recipe = (id: string, ingredients: [string, number][]): Recipe =>
  ({ id, itemId: id, ingredients: ingredients.map(([resourceId, quantity]) => ({ resourceId, quantity })) });
const res = (id: string, craftable?: boolean): Resource => (craftable === undefined ? { id, name: id } : { id, name: id, craftable });

describe('loadRecipeTree (specs/015)', () => {
  beforeEach(() => getResourceRecipe.mockReset());

  it('loads a three-level chain', async () => {
    getResourceRecipe.mockImplementation(async (id) => ({
      mid: { recipe: recipe('mid', [['leaf', 3]]), resources: [res('leaf', true)] },
      leaf: { recipe: recipe('leaf', [['ore', 4]]), resources: [res('ore', false)] },
    }[id] ?? null));
    const tree = await loadRecipeTree(recipe('top', [['mid', 2]]), [res('mid', true)]);
    expect(tree.recipes.mid?.ingredients[0].resourceId).toBe('leaf');
    expect(tree.recipes.leaf?.ingredients[0].resourceId).toBe('ore');
    expect(tree.recipes.ore).toBeNull();
    expect(getResourceRecipe).not.toHaveBeenCalledWith('ore');
  });

  it('requests a resource shared by several branches only once', async () => {
    getResourceRecipe.mockImplementation(async (id) => ({
      a: { recipe: recipe('a', [['shared', 1]]), resources: [res('shared', true)] },
      b: { recipe: recipe('b', [['shared', 1]]), resources: [res('shared', true)] },
    }[id] ?? null));
    await loadRecipeTree(recipe('top', [['a', 1], ['b', 1]]), [res('a', true), res('b', true)]);
    expect(getResourceRecipe.mock.calls.filter(([id]) => id === 'shared')).toHaveLength(1);
  });

  it('never requests a resource known not to be craftable, but checks one of unknown status', async () => {
    getResourceRecipe.mockResolvedValue(null);
    const tree = await loadRecipeTree(recipe('top', [['no', 1], ['maybe', 1]]), [res('no', false), res('maybe')]);
    expect(getResourceRecipe).toHaveBeenCalledWith('maybe');
    expect(getResourceRecipe).not.toHaveBeenCalledWith('no');
    expect(tree.recipes).toEqual({ no: null, maybe: null });
  });

  it('records a network error as "no recipe" without rejecting', async () => {
    getResourceRecipe.mockImplementationOnce(async () => { throw new Error('offline'); });
    const tree = await loadRecipeTree(recipe('top', [['a', 1]]), [res('a', true)]);
    expect(tree.recipes.a).toBeNull();
  });

  it('terminates on a cycle', async () => {
    getResourceRecipe.mockImplementation(async (id) => ({
      a: { recipe: recipe('a', [['b', 1]]), resources: [res('b', true)] },
      b: { recipe: recipe('b', [['a', 1]]), resources: [res('a', true)] },
    }[id] ?? null));
    const tree = await loadRecipeTree(recipe('top', [['a', 1]]), [res('a', true)]);
    expect(Object.keys(tree.recipes).sort()).toEqual(['a', 'b']);
    expect(getResourceRecipe).toHaveBeenCalledTimes(2);
  });

  it('reports progress after each recipe', async () => {
    getResourceRecipe.mockImplementation(async (id) => (id === 'a' ? { recipe: recipe('a', [['x', 1]]), resources: [res('x', false)] } : null));
    const onProgress = vi.fn();
    await loadRecipeTree(recipe('top', [['a', 1]]), [res('a', true)], onProgress);
    expect(onProgress).toHaveBeenCalled();
    expect(onProgress.mock.calls.at(-1)?.[0].recipes.a).toBeTruthy();
  });
});
