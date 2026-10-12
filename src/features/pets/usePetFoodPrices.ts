import { useEffect, useState } from 'react';
import { pickCommunityPrice } from '../../domain/community-price-choice';
import { PET_FOODS, type PetFoodPrice } from '../../domain/pet-xp';
import type { PriceMode } from '../../domain/price-modes';
import { resourcePricesFor } from '../../persistence/resource-prices-for-mode';
import { getCommunityPrices } from '../../services/community-price-api';

// specs/022-pet-xp-calculator (research.md §4), amended by specs/024-latest-community-price: the
// prices of every pet food, from the carnet of the active mode — like the other pages. In Mode
// communautaire each food takes the latest shared price when it is more recent than the carnet's
// entry (or there is none), read in batches and written to the carnet with its own date, the same
// rule as every other page (FR-004, FR-007).

export type PetFoodPricesState = {
  status: 'loading' | 'ready';
  prices: Record<string, PetFoodPrice>;
  communityUnavailable: boolean;
};

const LOADING: PetFoodPricesState = { status: 'loading', prices: {}, communityUnavailable: false };

async function loadPrices(serverId: string, priceMode: PriceMode): Promise<Omit<PetFoodPricesState, 'status'>> {
  const ids = PET_FOODS.map((food) => food.itemId);
  const repository = resourcePricesFor(priceMode);
  const carnet = await repository.getMany(serverId, ids);
  const prices: Record<string, PetFoodPrice> = {};
  for (const [itemId, price] of Object.entries(carnet)) {
    prices[itemId] = { unitPriceKamas: price.unitPriceKamas, date: price.updatedAt, origin: 'carnet' };
  }
  if (priceMode !== 'community') return { prices, communityUnavailable: false };
  const lookup = await getCommunityPrices(ids, serverId);
  if (lookup.status === 'unavailable') return { prices, communityUnavailable: true };
  await Promise.all(lookup.prices.map(async (shared) => {
    const choice = pickCommunityPrice(carnet[shared.resourceId], { amountKamas: shared.latestAmountKamas, contributedAt: shared.latestContributionAt });
    if (!choice.replacesCarnet || !choice.price) return;
    prices[shared.resourceId] = { unitPriceKamas: choice.price.unitPriceKamas, date: choice.price.updatedAt, origin: 'community-latest' };
    await repository.save(serverId, shared.resourceId, shared.latestAmountKamas, shared.latestContributionAt).catch(() => undefined);
  }));
  return { prices, communityUnavailable: false };
}

// `attempt` goes up when the player asks again after the shared prices could not be reached.
export function usePetFoodPrices(serverId: string | undefined, priceMode: PriceMode, attempt = 0): PetFoodPricesState {
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
  }, [key, serverId, priceMode, attempt]);
  return loaded && loaded.key === key ? loaded.state : LOADING;
}
