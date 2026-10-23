import { useEffect, useState } from 'react';
import runeItems from '../../data/rune-items.json';
import { loadBrisageItemsIndex } from '../../data/brisage-items-repository';
import type { IndexedItem } from '../../domain/brisage-search';
import type { RuneItemsData } from '../../domain/forgemagie';
import type { PriceMode } from '../../domain/price-modes';
import { latestCoefficient, listStoredCoefficients, type StoredCoefficient } from '../../persistence/brisage-coefficients';
import { pinnedItemPrices } from '../../persistence/indexeddb-pinned-item-price-repository';
import { getSharedCoefficients, MAX_ITEMS_PER_READ } from '../../services/brisage-coefficient-api';
import { getSharedItemPrices } from '../../services/community-price-api';
import { loadRunePriceDetails } from './useRunePrices';

// specs/072-classement-brisage: everything the ranking needs, read once per server and price mode — the index of items,
// the HDV price of each item, the price of each rune (with their dates) and the coefficients (the ones kept on this
// device and the ones shared by the players, the more recent winning). A source that does not answer is named in
// `incomplete` and the rest is still given: the ranking is then incomplete, never invented (FR-014).

const RUNE_IDS = (runeItems as RuneItemsData).runes.map((rune) => rune.id);
/** Shared coefficients are read this many requests at a time. */
const PARALLEL_READS = 4;

export type RankingData = {
  status: 'loading' | 'ready';
  items: IndexedItem[];
  itemPrices: Map<string, { kamas: number; updatedAt?: string }>;
  runePrices: Record<string, number>;
  runePriceDates: Record<string, string | undefined>;
  coefficients: Map<string, StoredCoefficient>;
  /** The sources that could not be read, for the « Classement incomplet » notice. */
  incomplete: string[];
};

/** What was read is kept this long: coming back to the tab (after an item page) shows it at once instead of reading it again. */
const CACHE_TTL_MS = 5 * 60 * 1000;
type Cached = { at: number; data: RankingData; shared: Map<string, StoredCoefficient> };
const cache = new Map<string, Cached>();

/** The coefficients of the device and the shared ones, the more recent winning. */
function combine(local: Map<string, StoredCoefficient>, shared: Map<string, StoredCoefficient>): Map<string, StoredCoefficient> {
  const merged = new Map(local);
  for (const [itemId, note] of shared) {
    const best = latestCoefficient(merged.get(itemId), note);
    if (best) merged.set(itemId, best);
  }
  return merged;
}

/** The coefficient of an item was cleared: the shared one that was kept is forgotten too. */
export function forgetCachedCoefficient(serverId: string, itemId: string): void {
  for (const [key, entry] of cache) if (key.startsWith(`${serverId}:`)) entry.shared.delete(itemId);
}

/** Forgets what was kept (tests). */
export function forgetRankingCache(): void {
  cache.clear();
}

const LOADING: RankingData = { status: 'loading', items: [], itemPrices: new Map(), runePrices: {}, runePriceDates: {}, coefficients: new Map(), incomplete: [] };

async function loadItemPrices(serverId: string, priceMode: PriceMode): Promise<{ prices: RankingData['itemPrices']; unavailable: boolean }> {
  const prices: RankingData['itemPrices'] = new Map();
  if (priceMode === 'community') {
    const lookup = await getSharedItemPrices(serverId);
    if (lookup.status === 'unavailable') return { prices, unavailable: true };
    for (const entry of lookup.items) if (entry.amountKamas > 0) prices.set(entry.itemId, { kamas: entry.amountKamas, updatedAt: entry.contributedAt });
    return { prices, unavailable: false };
  }
  for (const entry of await pinnedItemPrices.listAllForServer(serverId)) {
    if (entry.marketPriceKamas > 0) prices.set(entry.itemId, { kamas: entry.marketPriceKamas, updatedAt: entry.updatedAt });
  }
  return { prices, unavailable: false };
}

export function useRankingData(serverId: string | undefined, priceMode: PriceMode): RankingData {
  const key = serverId ? `${serverId}:${priceMode}` : undefined;
  const [loaded, setLoaded] = useState<{ key: string; data: RankingData }>();

  useEffect(() => {
    if (!serverId || !key) return;
    let cancelled = false;
    const publish = (data: RankingData) => { if (!cancelled) setLoaded({ key, data }); };
    const kept = cache.get(key);
    // Only the shared prices are kept: the prices of the device are read from it in no time and may have just been noted.
    if (priceMode === 'community' && kept && Date.now() - kept.at < CACHE_TTL_MS) {
      // The coefficients noted on this device are read again: they may have changed on an item page.
      publish({ ...kept.data, coefficients: combine(listStoredCoefficients(serverId), kept.shared) });
      return () => { cancelled = true; };
    }
    (async () => {
      const [index, itemPrices, runePrices] = await Promise.allSettled([
        loadBrisageItemsIndex(),
        loadItemPrices(serverId, priceMode),
        loadRunePriceDetails(serverId, priceMode, RUNE_IDS),
      ]);
      const incomplete: string[] = [];
      const items = index.status === 'fulfilled' ? index.value.items : [];
      if (index.status === 'rejected') incomplete.push('liste des objets');
      const prices = itemPrices.status === 'fulfilled' ? itemPrices.value.prices : new Map<string, { kamas: number; updatedAt?: string }>();
      if (itemPrices.status === 'rejected' || (itemPrices.status === 'fulfilled' && itemPrices.value.unavailable)) incomplete.push('prix des objets');
      const runes: Record<string, number> = {};
      const runeDates: Record<string, string | undefined> = {};
      if (runePrices.status === 'fulfilled') {
        for (const [id, detail] of Object.entries(runePrices.value.prices)) {
          runes[id] = detail.unitPriceKamas;
          runeDates[id] = detail.updatedAt;
        }
        if (runePrices.value.communityUnavailable) incomplete.push('prix partagés des runes');
      } else {
        incomplete.push('prix des runes');
      }
      const local = listStoredCoefficients(serverId);
      const shared = new Map<string, StoredCoefficient>();
      let data: RankingData = { status: 'ready', items, itemPrices: prices, runePrices: runes, runePriceDates: runeDates, coefficients: new Map(local), incomplete };
      publish(data);

      // The shared coefficients are only asked for the items that have a price: the others are not ranked.
      const wanted = items.map((item) => item.id).filter((id) => prices.has(id));
      const chunks: string[][] = [];
      for (let start = 0; start < wanted.length; start += MAX_ITEMS_PER_READ) chunks.push(wanted.slice(start, start + MAX_ITEMS_PER_READ));
      let sharedFailed = false;
      for (let start = 0; start < chunks.length && !cancelled; start += PARALLEL_READS) {
        const answers = await Promise.all(chunks.slice(start, start + PARALLEL_READS).map((chunk) => getSharedCoefficients(serverId, chunk)));
        for (const answer of answers) {
          if (!answer) { sharedFailed = true; continue; }
          for (const [itemId, note] of answer) shared.set(itemId, note);
        }
        data = { ...data, coefficients: combine(local, shared) };
      }
      // One publication at the end: each one rebuilds the ranking and restarts the exo computation.
      if (cancelled) return;
      if (sharedFailed) data = { ...data, incomplete: [...data.incomplete, 'coefficients partagés'] };
      // An incomplete reading is not kept: the next visit tries again.
      if (priceMode === 'community' && data.incomplete.length === 0) cache.set(key, { at: Date.now(), data, shared });
      publish(data);
    })().catch(() => publish({ ...LOADING, status: 'ready', incomplete: ['données du classement'] }));
    return () => { cancelled = true; };
  }, [key, serverId, priceMode]);

  return loaded && loaded.key === key ? loaded.data : LOADING;
}
