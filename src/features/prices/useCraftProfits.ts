import { useEffect, useState } from 'react';
import { getItemDetail, getResourceDetails, whenCatalogueReady } from '../../data/catalogue-repository';
import { compare } from '../../domain/craft-comparison';
import { effectiveIngredientPrices, treeResourceIds } from '../../domain/craft-tree';
import { profitRow, type CraftProfitRow } from '../../domain/craft-profit';
import type { PriceMode } from '../../domain/price-modes';
import type { Recipe, RecipeTree, ResourcePrice } from '../../domain/types';
import { keepCraftProfits, readKeptCraftProfits } from '../../persistence/craft-profits-cache';
import { pinnedItemPrices } from '../../persistence/indexeddb-pinned-item-price-repository';
import { resourcePricesFor } from '../../persistence/resource-prices-for-mode';
import { getSharedItemPrices } from '../../services/community-price-api';
import { syncCommunityPrices } from '../comparison/community-gap-fill';
import { loadRecipeTree } from '../comparison/recipe-tree-loader';

// specs/019-craft-profit-list (research.md §1-§5): the Prix page's lines. Candidates are the items
// with an HDV price in the active mode — the device's own in Mode personnel, the group's latest shared
// one in Mode communautaire. Each one is costed exactly like the Recherche page in « Auto »: same
// recipe tree, same carnet (community medians filled in the same way), and **no** forced choice, so
// the player's Acheter / Crafter picks never change this page (FR-004).

const CONCURRENCY = 6;
// specs/021-background-data-loading (US2 scénario 4), revised by specs/054 (FR-009): while nobody is
// looking at the Prix page, the background preparation stays gentle — fewer loads at a time, each one
// first letting the browser handle the player's own input (`yieldToBrowser`).
const BACKGROUND_CONCURRENCY = 4;
const YIELD_TIMEOUT_MS = 200;

type Candidate = { itemId: string; marketPriceKamas: number; marketPriceDate: string };
type Costed = { item: { id: string; name: string; imageUrl?: string }; candidate: Candidate; recipe: Recipe; tree: RecipeTree };

export type CraftProfitsState = {
  status: 'loading' | 'ready' | 'unavailable';
  rows: CraftProfitRow[];
  // Candidates whose recipe is loaded, out of all candidates — for « Calcul en cours… (n / total) ».
  done: number;
  total: number;
  // specs/054 (FR-003): set while the list shown is the one kept from a previous visit — when it was
  // computed — and whether its update has failed.
  keptAt?: string;
  refreshFailed?: boolean;
};

const INITIAL: CraftProfitsState = { status: 'loading', rows: [], done: 0, total: 0 };

// The last complete result per server and mode, kept for the visit: coming back to the page shows it
// at once, while a fresh computation runs in the background and replaces it only once finished — so
// the list never empties or flickers. Also kept on the device for the next visits (specs/054), where
// it is shown with its date until the fresh one arrives.
const cache = new Map<string, CraftProfitsState>();

export function clearCraftProfitsCache() {
  cache.clear();
}

type Listener = (state: CraftProfitsState) => void;

// specs/021 (FR-007): one computation per server + mode, shared by the background preparation and
// the page — whoever asks second just subscribes to the one already running.
type Run = {
  listeners: Set<Listener>;
  latest: CraftProfitsState | undefined;
  cancelled: boolean;
  foreground: boolean;
};
const runs = new Map<string, Run>();
// The server + mode currently active in the app: a run for any other context that loses its last
// page subscriber is cancelled (FR-009), the active one keeps going for the page to pick up.
let activeKey: string | undefined;

async function loadCandidates(serverId: string, priceMode: PriceMode): Promise<Candidate[] | undefined> {
  if (priceMode === 'community') {
    const lookup = await getSharedItemPrices(serverId);
    if (lookup.status === 'unavailable') return undefined;
    return lookup.items.map((entry) => ({ itemId: entry.itemId, marketPriceKamas: entry.amountKamas, marketPriceDate: entry.contributedAt }));
  }
  const entries = await pinnedItemPrices.listAllForServer(serverId);
  return entries.map((entry) => ({ itemId: entry.itemId, marketPriceKamas: entry.marketPriceKamas, marketPriceDate: entry.updatedAt }));
}

// Runs `task` over `items`, with at most `limit()` running at a time (re-read as tasks finish, so a
// background run speeds up as soon as the page subscribes).
async function forEachLimited<T>(items: T[], limit: () => number, task: (item: T) => Promise<void>) {
  let next = 0;
  let running = 0;
  await new Promise<void>((resolve) => {
    if (items.length === 0) {
      resolve();
      return;
    }
    let finished = 0;
    const pump = () => {
      while (running < limit() && next < items.length) {
        const item = items[next++];
        running += 1;
        void task(item).finally(() => {
          running -= 1;
          finished += 1;
          if (finished === items.length) resolve();
          else pump();
        });
      }
    };
    pump();
  });
}

// Lets the browser handle pending input and rendering before the next background load (specs/054 FR-009).
function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(() => resolve(), { timeout: YIELD_TIMEOUT_MS });
    else window.setTimeout(resolve, 0);
  });
}

// `complete` is false when some recipe couldn't be loaded: the list is shown for the visit but never
// kept for the next ones, where it would replace a good list with a shorter one (specs/054).
type Publish = (state: CraftProfitsState, complete?: boolean) => void;

async function compute(serverId: string, priceMode: PriceMode, run: Run, publish: Publish) {
  const candidates = await loadCandidates(serverId, priceMode);
  if (run.cancelled) return;
  if (!candidates) {
    publish({ ...INITIAL, status: 'unavailable' });
    return;
  }
  const items = await getResourceDetails(candidates.map((candidate) => candidate.itemId));
  if (run.cancelled) return;
  const repository = resourcePricesFor(priceMode);
  const prices: Record<string, ResourcePrice> = {};
  const costed: Costed[] = [];
  let done = 0;
  let failures = 0;

  const rows = () => costed
    .map(({ item, candidate, recipe, tree }) => profitRow(
      item,
      compare(recipe, effectiveIngredientPrices(recipe, tree, prices, {}), candidate.marketPriceKamas),
      candidate.marketPriceDate,
    ))
    .filter((row): row is CraftProfitRow => row !== undefined);
  const progress = () => publish({ status: 'loading', rows: rows(), done, total: candidates.length });
  progress();

  await forEachLimited(candidates, () => (run.foreground ? CONCURRENCY : BACKGROUND_CONCURRENCY), async (candidate) => {
    if (run.cancelled) return;
    if (!run.foreground) await yieldToBrowser();
    if (run.cancelled) return;
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
      failures += 1;
    }
    done += 1;
    if (!run.cancelled) progress();
  });
  if (run.cancelled) return;
  // Mode communautaire (specs/024): the latest shared prices the Recherche page would sync into the
  // carnet, the same way. `useCraftProfits` starts a new run each time the page opens (the kept list
  // stays shown meanwhile), so a price shared since the last visit is picked up without reloading
  // the tab (FR-013).
  if (priceMode === 'community') {
    const resourceIds = [...new Set(costed.flatMap(({ recipe, tree }) => treeResourceIds(recipe, tree)))];
    await syncCommunityPrices(serverId, resourceIds, prices, (resourceId, amountKamas, updatedAt) => repository.save(serverId, resourceId, amountKamas, updatedAt), () => run.cancelled);
  }
  if (run.cancelled) return;
  publish({ status: 'ready', rows: rows(), done, total: candidates.length }, failures === 0);
}

// Starts (or joins) the computation for `serverId` + `priceMode`. A finished result is kept in
// `cache` for the visit; nothing partial is ever stored as finished (spec edge case).
function startRun(serverId: string, priceMode: PriceMode): Run {
  const key = `${serverId}:${priceMode}`;
  const existing = runs.get(key);
  if (existing) return existing;
  const run: Run = { listeners: new Set(), latest: undefined, cancelled: false, foreground: false };
  runs.set(key, run);
  const publish: Publish = (state, complete = true) => {
    if (run.cancelled) return;
    run.latest = state;
    if (state.status === 'ready') {
      cache.set(key, state);
      if (complete) keepCraftProfits(serverId, priceMode, state.rows, new Date().toISOString());
    }
    run.listeners.forEach((listener) => listener(state));
  };
  void compute(serverId, priceMode, run, publish)
    .catch(() => publish({ ...INITIAL, status: 'unavailable' }))
    .finally(() => {
      if (runs.get(key) === run) runs.delete(key);
    });
  return run;
}

// specs/021 (FR-006), revised by specs/054 (FR-008): prepares the Prix list in the background as soon
// as the catalogue is ready, without waiting for the browser to be idle. Does nothing if a list of this
// visit or a computation already exists for this context; a list kept from a previous visit is updated.
export function preloadCraftProfits(serverId: string | undefined, priceMode: PriceMode): () => void {
  activeKey = serverId ? `${serverId}:${priceMode}` : undefined;
  // Runs for other contexts that no page is watching are no longer useful (FR-009).
  for (const [key, run] of runs) {
    if (key !== activeKey && run.listeners.size === 0) {
      run.cancelled = true;
      runs.delete(key);
    }
  }
  if (!serverId) return () => undefined;
  const key = `${serverId}:${priceMode}`;
  let stopped = false;
  void whenCatalogueReady().catch(() => undefined).then(() => {
    if (stopped || cache.has(key) || runs.has(key) || activeKey !== key) return;
    startRun(serverId, priceMode);
  });
  return () => {
    stopped = true;
  };
}

// The list to show before any computation: this visit's, else the one kept from a previous visit,
// marked with its date (specs/054 FR-002, FR-003).
function shownList(key: string, serverId: string | undefined, priceMode: PriceMode): CraftProfitsState | undefined {
  const visit = cache.get(key);
  if (visit || !serverId) return visit;
  const kept = readKeptCraftProfits(serverId, priceMode);
  return kept && { status: 'ready', rows: kept.rows, done: kept.rows.length, total: kept.rows.length, keptAt: kept.computedAt };
}

// `attempt` goes up when the player asks again after a failed computation.
export function useCraftProfits(serverId: string | undefined, priceMode: PriceMode, attempt = 0): CraftProfitsState {
  const key = `${serverId}:${priceMode}`;
  const initialFor = () => shownList(key, serverId, priceMode) ?? runs.get(key)?.latest ?? INITIAL;
  // The state remembers which server + mode it belongs to: right after a change, until the effect
  // below runs, the list of the previous context is never returned (specs/054 FR-011).
  const [shown, setShown] = useState(() => ({ key, state: initialFor() }));

  useEffect(() => {
    const setState = (next: CraftProfitsState) => setShown({ key, state: next });
    if (!serverId) {
      setState({ ...INITIAL, status: 'ready' });
      return;
    }
    const cached = shownList(key, serverId, priceMode);
    // A list already shown this visit — or kept from a previous one — is refreshed quietly: it stays
    // on screen until the fresh computation is complete, so the list never empties or flickers. The
    // cache is kept until then (replaced by `publish`), so leaving and coming back mid-refresh still
    // shows it.
    const run = startRun(serverId, priceMode);
    setState(cached ?? run.latest ?? INITIAL);
    run.foreground = true;
    const listener: Listener = (next) => {
      if (next.status === 'unavailable') {
        // Keep a list already shown rather than replacing it with an error; a kept one says its
        // update failed (specs/054 FR-003).
        if (!cached) setState(next);
        else if (cached.keptAt) setState({ ...cached, refreshFailed: true });
        return;
      }
      if (next.status === 'ready' || !cached) setState(next);
    };
    run.listeners.add(listener);
    return () => {
      run.listeners.delete(listener);
      if (run.listeners.size === 0) {
        run.foreground = false;
        if (key !== activeKey) {
          run.cancelled = true;
          if (runs.get(key) === run) runs.delete(key);
        }
      }
    };
  }, [key, serverId, priceMode, attempt]);

  return shown.key === key ? shown.state : initialFor();
}
