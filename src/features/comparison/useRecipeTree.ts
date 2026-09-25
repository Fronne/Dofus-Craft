import { useEffect, useState } from 'react';
import type { Recipe, RecipeTree, Resource } from '../../domain/types';
import { loadRecipeTree } from './recipe-tree-loader';

function initialTree(resources: Resource[]): RecipeTree {
  return { recipes: {}, resources: Object.fromEntries(resources.map((resource) => [resource.id, resource])) };
}

// specs/015 FR-013: the recipe tree below the selected item, growing as recipes arrive — the
// top-level lines never wait for it. Answers for a previously selected item are dropped.
export function useRecipeTree(recipe: Recipe | undefined, resources: Resource[]): RecipeTree {
  const [tree, setTree] = useState<RecipeTree>(() => initialTree(resources));
  const recipeKey = recipe ? `${recipe.id}:${recipe.ingredients.map((ingredient) => ingredient.resourceId).join(',')}` : '';

  useEffect(() => {
    setTree(initialTree(resources));
    if (!recipe) return;
    let cancelled = false;
    void loadRecipeTree(recipe, resources, (next) => {
      if (!cancelled) setTree(next);
    }).then((final) => {
      if (!cancelled) setTree(final);
    });
    return () => {
      cancelled = true;
    };
    // `recipeKey` stands for `recipe`/`resources`, which are fresh objects on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeKey]);

  return tree;
}
