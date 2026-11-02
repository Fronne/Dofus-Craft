import { useEffect, useMemo, useState } from 'react';
import { loadBrisageItemsIndex } from '../../data/brisage-items-repository';
import { evaluateListings, isFresh, type DealCalibration, type DealVerdict, type ItemEffect, type Listing } from '../../domain/good-deals';
import type { IndexedItem } from '../../domain/brisage-search';
import { getGoodDealsPayload } from '../../services/good-deals-api';

// specs/078-bons-plans-hdv: reads the fresh announcements of a server and judges them. The judging is the
// pure rule of src/domain/good-deals.ts; this hook only loads and groups.

export type Deal = DealVerdict & {
  listing: Listing;
  itemName: string;
  imageUrl?: string;
  /** What the item can roll normally: the theoretical bounds shown beside each line. */
  itemEffects: ItemEffect[];
};

export type GoodDealsState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; deals: Deal[]; thresholdPercent: number; adminThresholdPercent: number };

type ListedItem = { item: IndexedItem; listings: Listing[] };
type Loaded = { status: 'loading' } | { status: 'error' } | { status: 'ready'; listed: ListedItem[]; thresholdPercent: number };

// specs/080: what was read stays here, so a change of calibration judges again without asking the network.
export function useGoodDeals(serverId: string | undefined, calibration?: DealCalibration): GoodDealsState {
  const [state, setState] = useState<{ serverId?: string; value: Loaded }>({ value: { status: 'loading' } });

  useEffect(() => {
    if (!serverId) return;
    let cancelled = false;
    Promise.all([getGoodDealsPayload(serverId), loadBrisageItemsIndex().catch(() => undefined)]).then(([payload, index]) => {
      if (cancelled) return;
      if (!payload || !index) {
        setState({ serverId, value: { status: 'error' } });
        return;
      }
      const items = new Map(index.items.map((item) => [item.id, item]));
      const now = new Date();
      const byItem = new Map<string, Listing[]>();
      for (const listing of payload.listings) {
        if (!isFresh(listing, now)) continue;
        byItem.set(listing.itemId, [...(byItem.get(listing.itemId) ?? []), listing]);
      }
      const listed: ListedItem[] = [];
      for (const [itemId, listings] of byItem) {
        // An item the index does not know cannot tell its exo apart: it is left out rather than guessed.
        const item = items.get(itemId);
        if (item) listed.push({ item, listings });
      }
      setState({ serverId, value: { status: 'ready', listed, thresholdPercent: payload.thresholdPercent } });
    });
    return () => {
      cancelled = true;
    };
  }, [serverId]);

  const loaded = state.serverId === serverId ? state.value : undefined;
  return useMemo((): GoodDealsState => {
    if (!loaded || loaded.status === 'loading') return { status: 'loading' };
    if (loaded.status === 'error') return { status: 'error' };
    const thresholdPercent = calibration?.thresholdPercent ?? loaded.thresholdPercent;
    const deals = loaded.listed.flatMap(({ item, listings }) =>
      evaluateListings(listings, item.effects, thresholdPercent, calibration).map((verdict, position): Deal => (
        { ...verdict, listing: listings[position], itemName: item.name, imageUrl: item.imageUrl, itemEffects: item.effects })));
    return { status: 'ready', deals, thresholdPercent, adminThresholdPercent: loaded.thresholdPercent };
  }, [loaded, calibration]);
}
