import { useEffect, useState } from 'react';
import { loadBrisageItemsIndex } from '../../data/brisage-items-repository';
import { evaluateListings, isFresh, type DealVerdict, type ItemEffect, type Listing } from '../../domain/good-deals';
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
  | { status: 'ready'; deals: Deal[]; thresholdPercent: number };

export function useGoodDeals(serverId: string | undefined): GoodDealsState {
  const [state, setState] = useState<{ serverId?: string; value: GoodDealsState }>({ value: { status: 'loading' } });

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
      const deals: Deal[] = [];
      for (const [itemId, listings] of byItem) {
        // An item the index does not know cannot tell its exo apart: it is left out rather than guessed.
        const item = items.get(itemId);
        if (!item) continue;
        const verdicts = evaluateListings(listings, item.effects, payload.thresholdPercent);
        verdicts.forEach((verdict, position) => {
          deals.push({ ...verdict, listing: listings[position], itemName: item.name, imageUrl: item.imageUrl, itemEffects: item.effects });
        });
      }
      setState({ serverId, value: { status: 'ready', deals, thresholdPercent: payload.thresholdPercent } });
    });
    return () => {
      cancelled = true;
    };
  }, [serverId]);

  return state.serverId === serverId ? state.value : { status: 'loading' };
}
