import { useEffect, useState } from 'react';
import { getItemDetail } from '../../data/catalogue-repository';
import { resourcePricesFor } from '../../persistence/resource-prices-for-mode';
import type { PriceMode } from '../../domain/price-modes';
import { pinnedItemPrices } from '../../persistence/indexeddb-pinned-item-price-repository';
import { compare } from '../../domain/craft-comparison';
import { effectiveIngredientPrices, treeResourceIds } from '../../domain/craft-tree';
import { loadRecipeTree } from '../comparison/recipe-tree-loader';
import { lookupLatestItemPrice } from '../comparison/useSharedItemPrice';
import { getIngredientChoices } from '../../persistence/ingredient-choices';
import type { RecipeTree, ResourcePrice } from '../../domain/types';
import { syncCommunityPrices } from '../comparison/community-gap-fill';

export type PinnedPriceSummary = {
  craftCostKamas?: number;
  marketPriceKamas?: number;
  recommendation?: 'craft' | 'buy' | 'equal';
};

async function sharedMarketPrices(serverId: string, ids: string[]): Promise<Record<string, { marketPriceKamas: number }>> {
  const prices = await Promise.all(ids.map((id) => lookupLatestItemPrice(id, serverId)));
  const byId: Record<string, { marketPriceKamas: number }> = {};
  ids.forEach((id, index) => {
    const price = prices[index];
    if (price) byId[id] = { marketPriceKamas: price.amountKamas };
  });
  return byId;
}

export function usePinnedSummaries(serverId: string | undefined, pinnedItemIds: string, priceMode: PriceMode) {
  const [summaries, setSummaries] = useState<Record<string, PinnedPriceSummary>>({});
  const [loadingSummaries, setLoadingSummaries] = useState(true);
  // The prices could not be computed (a recipe or a carnet read failed); « Réessayer » asks again.
  const [summariesError, setSummariesError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!serverId || !pinnedItemIds) {
      setSummaries({});
      setLoadingSummaries(false);
      return;
    }
    let cancelled = false;
    setLoadingSummaries(true);
    setSummariesError(false);
    const ids = pinnedItemIds.split(',');
    (async () => {
      const [details, marketPrices] = await Promise.all([
        Promise.all(ids.map((id) => getItemDetail(id))),
        // specs/016 FR-009: in Mode communautaire each card shows the group's latest shared HDV price
        // (the same one as the item's detail); Mode personnel keeps the device's own price.
        priceMode === 'community' ? sharedMarketPrices(serverId, ids) : pinnedItemPrices.getMany(serverId, ids),
      ]);
      // specs/015 FR-011: the whole craft chain of each item, exactly as its detail page counts it —
      // same recipe tree, same carnet (every resource of the chain), same forced choices. The cards
      // first show what the top-level carnet prices give, then refine once the recipe trees are in.
      const trees: RecipeTree[] = details.map((detail) => ({
        recipes: {},
        resources: Object.fromEntries(detail.resources.map((resource) => [resource.id, resource])),
      }));
      const choices = getIngredientChoices();
      const repository = resourcePricesFor(priceMode);
      const resourcePrices: Record<string, ResourcePrice> = {};
      const chainResourceIds = () => [...new Set(details.flatMap((detail, index) =>
        (detail.recipe ? treeResourceIds(detail.recipe, trees[index]) : [])))];
      const readCarnet = async () => {
        const missing = chainResourceIds().filter((resourceId) => !resourcePrices[resourceId]);
        Object.assign(resourcePrices, await repository.getMany(serverId, missing));
      };
      const summarize = () => {
        const next: Record<string, PinnedPriceSummary> = {};
        ids.forEach((id, index) => {
          const detail = details[index];
          const marketPriceKamas = marketPrices[id]?.marketPriceKamas;
          const result = detail.recipe
            ? compare(detail.recipe, effectiveIngredientPrices(detail.recipe, trees[index], resourcePrices, choices), marketPriceKamas)
            : undefined;
          next[id] = {
            craftCostKamas: result?.craftCostStatus === 'complete' ? result.knownCraftCostKamas : undefined,
            marketPriceKamas,
            recommendation: result && result.recommendation !== 'insufficient-data' ? result.recommendation : undefined,
          };
        });
        setSummaries(next);
      };
      await readCarnet();
      if (cancelled) return;
      summarize();
      setLoadingSummaries(false);

      const loaded = await Promise.all(details.map((detail, index) => (detail.recipe
        ? loadRecipeTree(detail.recipe, detail.resources)
        : Promise.resolve(trees[index]))));
      if (cancelled) return;
      loaded.forEach((tree, index) => {
        trees[index] = tree;
      });
      await readCarnet();
      if (cancelled) return;
      summarize();
      // Mode communautaire (specs/024): RecherchePage only syncs a resource's latest shared price into
      // the carnet when that item's detail is displayed, so an item pinned earlier could show an old
      // price (or "Non renseigné") here. Sync the same way, so both pages agree — after the carnet
      // values are already on screen, so a slow network never delays them.
      if (priceMode !== 'community') return;
      await syncCommunityPrices(serverId, chainResourceIds(), resourcePrices, (resourceId, amountKamas, updatedAt) => repository.save(serverId, resourceId, amountKamas, updatedAt), () => cancelled);
      if (!cancelled) summarize();
    })().catch(() => {
      // Never left on « … »: what was computed stays, and the failure is said.
      if (cancelled) return;
      setSummariesError(true);
      setLoadingSummaries(false);
    });
    return () => {
      cancelled = true;
    };
  }, [serverId, pinnedItemIds, priceMode, attempt]);

  return { summaries, loadingSummaries, summariesError, retry: () => setAttempt((count) => count + 1) };
}
