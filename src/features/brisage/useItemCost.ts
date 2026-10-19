import { useEffect, useState } from 'react';
import type { PriceMode } from '../../domain/price-modes';
import { pinnedItemPrices } from '../../persistence/indexeddb-pinned-item-price-repository';
import { getLatestItemPrice } from '../../services/community-price-api';

// specs/061-simplification-page-brisage (FR-002): the cost of the item is the HDV price already noted
// on the Recherche page — the device's own price in Mode personnel, the group's latest shared price in
// Mode communautaire (as Recherche does). No price → `costKamas` stays undefined, nothing is guessed.

export type ItemCostState = { status: 'loading' | 'ready'; costKamas?: number };

const LOADING: ItemCostState = { status: 'loading' };

async function loadCost(serverId: string, itemId: string, priceMode: PriceMode): Promise<number | undefined> {
  if (priceMode === 'community') {
    const lookup = await getLatestItemPrice(itemId, serverId);
    return lookup.status === 'found' && lookup.price.amountKamas > 0 ? lookup.price.amountKamas : undefined;
  }
  const price = (await pinnedItemPrices.get(serverId, itemId))?.marketPriceKamas;
  return price !== undefined && price > 0 ? price : undefined;
}

export function useItemCost(serverId: string | undefined, itemId: string | undefined, priceMode: PriceMode): ItemCostState {
  const key = serverId && itemId ? `${serverId}:${itemId}:${priceMode}` : undefined;
  const [loaded, setLoaded] = useState<{ key: string; state: ItemCostState }>();
  useEffect(() => {
    if (!serverId || !itemId || !key) return;
    let cancelled = false;
    loadCost(serverId, itemId, priceMode)
      .then((costKamas) => { if (!cancelled) setLoaded({ key, state: { status: 'ready', costKamas } }); })
      .catch(() => { if (!cancelled) setLoaded({ key, state: { status: 'ready' } }); });
    return () => { cancelled = true; };
  }, [key, serverId, itemId, priceMode]);
  return loaded && loaded.key === key ? loaded.state : LOADING;
}
