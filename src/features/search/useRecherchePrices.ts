import { useEffect, useRef, useState } from 'react';
import type { Recipe, Resource, ResourcePrice } from '../../domain/types';
import { compare } from '../../domain/craft-comparison';
import { parseKamas } from '../../domain/kamas';
import { effectiveIngredientPrices, retainedCost, treeResourceIds } from '../../domain/craft-tree';
import { resourcePricesFor } from '../../persistence/resource-prices-for-mode';
import type { PriceMode } from '../../domain/price-modes';
import { useRecipeTree } from '../comparison/useRecipeTree';
import { useIngredientChoices } from '../comparison/useIngredientChoices';
import { useResourcePrices } from '../comparison/useResourcePrices';
import { syncCommunityPrices } from '../comparison/community-gap-fill';

// The craft chain of the chosen item with the prices typed or kept for its resources, and what
// they add up to against the HDV price.
export function useRecherchePrices({ serverId, priceMode, selected, recipe, resources, market, reload }: {
  serverId: string | undefined;
  priceMode: PriceMode;
  selected: string;
  recipe: Recipe | undefined;
  resources: Resource[];
  market: string;
  reload: number;
}) {
  const [inputs, setInputs] = useState<Record<string, string>>({});
  useEffect(() => {
    setInputs({});
  }, [serverId]);
  // specs/015: the whole craft chain below the item — its intermediate recipes load progressively,
  // and the carnet is read for every resource in it, not just the top-level ingredients.
  const recipeTree = useRecipeTree(recipe, resources);
  // specs/015 US2: unfolded lines, by path from the top-level ingredient ("16489>303"); folded
  // again whenever another item is selected.
  const [expandedPaths, setExpandedPaths] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    setExpandedPaths(new Set());
  }, [selected]);
  const toggleExpanded = (path: string) => setExpandedPaths((current) => {
    const next = new Set(current);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    return next;
  });
  const ids = recipe ? treeResourceIds(recipe, recipeTree) : [];
  // FR-005: the craft-cost comparison below MUST read exclusively from the carnet of the active
  // mode — the personal `prices` repository in Mode personnel (unchanged), the physically separate
  // `communityModePrices` repository in Mode communautaire — and MUST NOT fall back to or merge
  // with the other one. Switching `priceMode` swaps which repository `useResourcePrices` reads
  // and writes; `market` (HDV price, `pinnedItemPrices`) is item-level and untouched by this
  // revision (spec.md Assumptions), never drawn into this branching.
  const { data, save, remove, error, loaded: pricesLoaded } = useResourcePrices(serverId, ids, resourcePricesFor(priceMode));
  const merged: Record<string, ResourcePrice> = {};

  ids.forEach((id) => {
    const input = inputs[id];
    const price =
      input === undefined ? data[id]?.unitPriceKamas : parseKamas(input);
    if (price !== undefined && Number.isFinite(price)) {
      merged[id] = {
        resourceId: id,
        unitPriceKamas: price,
        updatedAt: data[id]?.updatedAt ?? '',
      };
    }
  });

  // specs/015 FR-004: each ingredient counts for its retained cost (cheaper of buying and crafting),
  // computed by the same function the Suivis page uses, so both show the same craft cost (FR-011).
  const { choices: ingredientChoices, setChoice: setIngredientChoice } = useIngredientChoices();
  const result = recipe
    ? compare(recipe, effectiveIngredientPrices(recipe, recipeTree, merged, ingredientChoices), parseKamas(market))
    : undefined;

  // specs/015 research.md §7, specs/024 (Mode communautaire): every resource of the tree gets the
  // latest shared price when it is more recent than the carnet's, collapsed sub-resources included —
  // the Suivis and Rentabilité pages sync the same way, so every page counts the same prices.
  // Displayed lines are left to their own sync (CommunityResourcePriceRow), so a price is never
  // written twice. Only once the carnet read for the current ids has settled (`pricesLoaded`), so
  // "not loaded yet" is never mistaken for "no entry", and each resource is asked for once per item
  // shown.
  const gapFillRequested = useRef(new Set<string>());
  useEffect(() => {
    gapFillRequested.current = new Set();
  }, [serverId, priceMode, selected, reload]);
  // Lines on screen: the top-level ingredients plus the sub-resources of every unfolded line.
  const displayedIds = new Set<string>();
  for (const ingredient of recipe?.ingredients ?? []) displayedIds.add(ingredient.resourceId);
  for (const path of expandedPaths) {
    const expanded = recipeTree.recipes[path.split('>').at(-1) as string];
    expanded?.ingredients.forEach((ingredient) => displayedIds.add(ingredient.resourceId));
  }
  const idsKey = ids.join(',');
  useEffect(() => {
    if (priceMode !== 'community' || !serverId || !pricesLoaded) return;
    const hidden = idsKey.split(',').filter((id) =>
      id && !displayedIds.has(id) && !gapFillRequested.current.has(id));
    if (hidden.length === 0) return;
    hidden.forEach((id) => gapFillRequested.current.add(id));
    let cancelled = false;
    void syncCommunityPrices(serverId, hidden, { ...data }, async (resourceId, amountKamas, updatedAt) => {
      await save(resourceId, amountKamas, updatedAt);
    }, () => cancelled);
    return () => {
      cancelled = true;
    };
    // `data`/`save` change with every carnet write; the gap fill only needs to re-run when the set
    // of resources or the settled state changes, and the Set above prevents asking twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceMode, serverId, pricesLoaded, idsKey, reload]);

  // Top-level lines' retained costs. The guided tour's "Ingrédients craftables" step points at the
  // first craftable one, and unfolds its recipe while the step is shown.
  const topCosts = recipe
    ? recipe.ingredients.map((ingredient) =>
      retainedCost(ingredient.resourceId, recipeTree, merged, ingredientChoices, new Set([recipe.itemId])))
    : [];
  const firstCraftable = topCosts.findIndex((cost) => cost.children !== undefined);
  const firstCraftablePath = firstCraftable >= 0 ? topCosts[firstCraftable].resourceId : undefined;

  return {
    inputs, setInputs,
    recipeTree,
    expandedPaths, setExpandedPaths, toggleExpanded,
    ids,
    carnet: { data, save, remove, loaded: pricesLoaded },
    error,
    ingredientChoices, setIngredientChoice,
    result,
    topCosts, firstCraftable, firstCraftablePath,
  };
}
