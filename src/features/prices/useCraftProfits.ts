import { useEffect, useState } from 'react';
import { getItemDetail, getResourceDetails } from '../../data/catalogue-repository';
import { compare } from '../../domain/craft-comparison';
import { effectiveIngredientPrices, treeResourceIds } from '../../domain/craft-tree';
import { profitRow, type CraftProfitRow } from '../../domain/craft-profit';
import type { PriceMode } from '../../domain/price-modes';
import type { Recipe, RecipeTree, ResourcePrice } from '../../domain/types';
import { pinnedItemPrices } from '../../persistence/indexeddb-pinned-item-price-repository';
import { resourcePricesFor } from '../../persistence/resource-prices-for-mode';
import { getSharedItemPrices } from '../../services/community-price-api';
import { fillCommunityGaps } from '../comparison/community-gap-fill';
import { loadRecipeTree } from '../comparison/recipe-tree-loader';

// specs/019-craft-profit-list (research.md §1-§5): the Prix page's lines. Candidates are the items
// with an HDV price in the active mode — the device's own in Mode personnel, the group's latest shared
// one in Mode communautaire. Each one is costed exactly like the Recherche page in « Auto »: same
// recipe tree, same carnet (community medians filled in the same way), and **no** forced choice, so
// the player's Acheter / Crafter picks never change this page (FR-004).

const CONCURRENCY = 6;

type Candidate = { itemId: string; marketPriceKamas: number; marketPriceDate: string };
type Costed = { item: { id: string; name: string; imageUrl?: string }; candidate: Candidate; recipe: Recipe; tree: RecipeTree };

export type CraftProfitsState = {
  status: 'loading' | 'ready' | 'unavailable';
  rows: CraftProfitRow[];
  // Candidates whose recipe is loaded, out of all candidates — for « Calcul en cours… (n / total) ».
  done: number;
  total: number;
};

const INITIAL: CraftProfitsState = { status: 'loading', rows: [], done: 0, total: 0 };

// The last complete result per server and mode, kept for the visit: coming back to the page shows it
// at once, while a fresh computation runs in the background and replaces it only once finished — so
// the list never empties or flickers. Not persisted: an old list shown after a reload could mislead.
const cache = new Map<string, CraftProfitsState>();

export function clearCraftProfitsCache() {
  cache.clear();
}

async function loadCandidates(serverId: string, priceMode: PriceMode): Promise<Candidate[] | undefined> {
  if (priceMode === 'community') {
    const lookup = await getSharedItemPrices(serverId);
    if (lookup.status === 'unavailable') return undefined;
    return lookup.items.map((entry) => ({ itemId: entry.itemId, marketPriceKamas: entry.amountKamas, marketPriceDate: entry.contributedAt }));
  }
  const entries = await pinnedItemPrices.listAllForServer(serverId);
  return entries.map((entry) => ({ itemId: entry.itemId, marketPriceKamas: entry.marketPriceKamas, marketPriceDate: entry.updatedAt }));
}

// Runs `task` over `items`, at most `limit` at a time.
async function forEachLimited<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await task(items[next++]);
  }));
}

export function useCraftProfits(serverId: string | undefined, priceMode: PriceMode): CraftProfitsState {
  const key = `${serverId}:${priceMode}`;
  const [state, setState] = useState<CraftProfitsState>(() => cache.get(key) ?? INITIAL);

  useEffect(() => {
    if (!serverId) {
      setState({ ...INITIAL, status: 'ready' });
      return;
    }
    let cancelled = false;
    const cached = cache.get(key);
    setState(cached ?? INITIAL);
    (async () => {
      const candidates = await loadCandidates(serverId, priceMode);
      if (cancelled) return;
      if (!candidates) {
        // Keep a list already shown rather than replacing it with an error.
        if (!cached) setState({ ...INITIAL, status: 'unavailable' });
        return;
      }
      const items = await getResourceDetails(candidates.map((candidate) => candidate.itemId));
      if (cancelled) return;
      const repository = resourcePricesFor(priceMode);
      const prices: Record<string, ResourcePrice> = {};
      const costed: Costed[] = [];
      let done = 0;

      const rows = () => costed
        .map(({ item, candidate, recipe, tree }) => profitRow(
          item,
          compare(recipe, effectiveIngredientPrices(recipe, tree, prices, {}), candidate.marketPriceKamas),
          candidate.marketPriceDate,
        ))
        .filter((row): row is CraftProfitRow => row !== undefined);
      const publish = (status: CraftProfitsState['status']) => {
        if (cancelled) return;
        const next = { status, rows: rows(), done, total: candidates.length };
        if (status === 'ready') cache.set(key, next);
        // A cached list stays on screen until the background computation is complete.
        if (status === 'ready' || !cached) setState(next);
      };
      publish('loading');

      await forEachLimited(candidates, CONCURRENCY, async (candidate) => {
        if (cancelled) return;
        try {
          const detail = await getItemDetail(candidate.itemId);
          const item = items.find((entry) => entry.id === candidate.itemId);
          if (detail.recipe && item) {
            const tree = await loadRecipeTree(detail.recipe, detail.resources);
            const missing = treeResourceIds(detail.recipe, tree).filter((resourceId) => !prices[resourceId]);
            Object.assign(prices, await repository.getMany(serverId, missing));
            costed.push({ item: { id: item.id, name: item.name, imageUrl: item.imageUrl }, candidate, recipe: detail.recipe, tree });
          }
        } catch {
          // An item whose recipe can't be loaded just isn't listed — never a guessed cost (FR-009).
        }
        done += 1;
        publish('loading');
      });
      if (cancelled) return;
      // Mode communautaire: the medians the Recherche page would copy into the carnet, the same way.
      if (priceMode === 'community') {
        const resourceIds = [...new Set(costed.flatMap(({ recipe, tree }) => treeResourceIds(recipe, tree)))];
        await fillCommunityGaps(serverId, resourceIds, prices, (resourceId, median) => repository.save(serverId, resourceId, median), () => cancelled);
      }
      publish('ready');
    })();
    return () => {
      cancelled = true;
    };
  }, [key, serverId, priceMode]);

  return state;
}
