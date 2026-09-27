import { useEffect, useState } from 'react';
import { PET_FOODS, type PetFoodPrice } from '../../domain/pet-xp';
import type { PriceMode } from '../../domain/price-modes';
import { resourcePricesFor } from '../../persistence/resource-prices-for-mode';
import { getCommunityPrices } from '../../services/community-price-api';

// specs/022-pet-xp-calculator (research.md §4): the prices of every pet food, from the carnet of the
// active mode — like the other pages. In Mode communautaire the foods with no carnet entry take the
// community median, read in batches and **never written** to the carnet: this page only consults.

export type PetFoodPricesState = {
  status: 'loading' | 'ready';
  prices: Record<string, PetFoodPrice>;
  communityUnavailable: boolean;
};

const LOADING: PetFoodPricesState = { status: 'loading', prices: {}, communityUnavailable: false };

async function loadPrices(serverId: string, priceMode: PriceMode): Promise<Omit<PetFoodPricesState, 'status'>> {
  const ids = PET_FOODS.map((food) => food.itemId);
  const carnet = await resourcePricesFor(priceMode).getMany(serverId, ids);
  const prices: Record<string, PetFoodPrice> = {};
  for (const [itemId, price] of Object.entries(carnet)) {
    prices[itemId] = { unitPriceKamas: price.unitPriceKamas, date: price.updatedAt, origin: 'carnet' };
  }
  if (priceMode !== 'community') return { prices, communityUnavailable: false };
  const missing = ids.filter((itemId) => !prices[itemId]);
  if (missing.length === 0) return { prices, communityUnavailable: false };
  const lookup = await getCommunityPrices(missing, serverId);
  if (lookup.status === 'unavailable') return { prices, communityUnavailable: true };
  for (const median of lookup.prices) {
    if (prices[median.resourceId] || median.medianAmountKamas <= 0) continue;
    prices[median.resourceId] = { unitPriceKamas: median.medianAmountKamas, date: median.lastContributionAt, origin: 'community-median' };
  }
  return { prices, communityUnavailable: false };
}

export function usePetFoodPrices(serverId: string | undefined, priceMode: PriceMode): PetFoodPricesState {
  const key = serverId ? `${serverId}:${priceMode}` : undefined;
  // The loaded prices remember which server + mode they belong to: any other context reads as loading.
  const [loaded, setLoaded] = useState<{ key: string; state: PetFoodPricesState }>();
  useEffect(() => {
    if (!serverId || !key) return;
    let cancelled = false;
    loadPrices(serverId, priceMode)
      .then((result) => {
        if (!cancelled) setLoaded({ key, state: { status: 'ready', ...result } });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ key, state: { status: 'ready', prices: {}, communityUnavailable: priceMode === 'community' } });
      });
    return () => {
      cancelled = true;
    };
  }, [key, serverId, priceMode]);
  return loaded && loaded.key === key ? loaded.state : LOADING;
}
