import { getResourceRecipe } from '../../data/catalogue-repository';
import type { Recipe, RecipeTree, Resource } from '../../domain/types';

// specs/015-intermediate-craft-costs (research.md §4-§5): walks the craft chain below `recipe`,
// fetching the recipe of every ingredient that may be craftable, in parallel and never twice.
// `craftable === false` needs no request; `undefined` (a detail cached before this feature) is
// checked. A resource with no recipe — or whose recipe couldn't be fetched — is recorded as `null`,
// i.e. counted as bought (FR-012). `onProgress` gets a fresh snapshot after each recipe arrives so
// the page can fill in progressively (FR-013).
export async function loadRecipeTree(
  recipe: Recipe,
  resources: Resource[],
  onProgress?: (tree: RecipeTree) => void,
): Promise<RecipeTree> {
  const recipes: Record<string, Recipe | null> = {};
  const known: Record<string, Resource> = {};
  const requested = new Set<string>([recipe.itemId]);
  const snapshot = (): RecipeTree => ({ recipes: { ...recipes }, resources: { ...known } });

  const addResources = (list: Resource[]) => {
    for (const resource of list) known[resource.id] = { ...known[resource.id], ...resource };
  };

  const visit = async (current: Recipe): Promise<void> => {
    const pending: Promise<void>[] = [];
    for (const { resourceId } of current.ingredients) {
      if (requested.has(resourceId)) continue;
      requested.add(resourceId);
      if (known[resourceId]?.craftable === false) {
        recipes[resourceId] = null;
        continue;
      }
      pending.push((async () => {
        let result: Awaited<ReturnType<typeof getResourceRecipe>>;
        try {
          result = await getResourceRecipe(resourceId);
        } catch {
          result = null;
        }
        recipes[resourceId] = result?.recipe ?? null;
        if (result) addResources(result.resources);
        onProgress?.(snapshot());
        if (result) await visit(result.recipe);
      })());
    }
    await Promise.all(pending);
  };

  addResources(resources);
  await visit(recipe);
  return snapshot();
}
