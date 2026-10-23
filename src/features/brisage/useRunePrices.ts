import { useEffect, useState } from 'react';
import { pickCommunityPrice } from '../../domain/community-price-choice';
import type { PriceMode } from '../../domain/price-modes';
import { resourcePricesFor } from '../../persistence/resource-prices-for-mode';
import { getCommunityPrices } from '../../services/community-price-api';

// specs/060-page-brisage (FR-004): the price of every rune, from the carnet of the active mode — in
// Mode communautaire the latest shared price replaces an older carnet entry, like the XP Familier page
// (specs/024). A rune without a price is simply absent: the page asks for it, it never guesses one.

export type RunePricesState = { status: 'loading' | 'ready'; prices: Record<string, number>; communityUnavailable: boolean };

const LOADING: RunePricesState = { status: 'loading', prices: {}, communityUnavailable: false };

/** A rune price with the date it was noted (specs/072: the ranking shows how fresh the prices it uses are). */
export type RunePriceDetail = { unitPriceKamas: number; updatedAt?: string };

/** The price of each rune of the active mode, with its date; a rune without a price is absent. */
export async function loadRunePriceDetails(
  serverId: string, priceMode: PriceMode, ids: string[],
): Promise<{ prices: Record<string, RunePriceDetail>; communityUnavailable: boolean }> {
  const repository = resourcePricesFor(priceMode);
  const carnet = await repository.getMany(serverId, ids);
  const prices: Record<string, RunePriceDetail> = {};
  for (const [id, price] of Object.entries(carnet)) prices[id] = { unitPriceKamas: price.unitPriceKamas, updatedAt: price.updatedAt };
  if (priceMode !== 'community') return { prices, communityUnavailable: false };
  const lookup = await getCommunityPrices(ids, serverId);
  if (lookup.status === 'unavailable') return { prices, communityUnavailable: true };
  for (const shared of lookup.prices) {
    const choice = pickCommunityPrice(carnet[shared.resourceId], { amountKamas: shared.latestAmountKamas, contributedAt: shared.latestContributionAt });
    if (choice.price) prices[shared.resourceId] = { unitPriceKamas: choice.price.unitPriceKamas, updatedAt: choice.price.updatedAt };
  }
  return { prices, communityUnavailable: false };
}

async function loadPrices(serverId: string, priceMode: PriceMode, ids: string[]): Promise<Omit<RunePricesState, 'status'>> {
  const { prices: detailed, communityUnavailable } = await loadRunePriceDetails(serverId, priceMode, ids);
  const prices: Record<string, number> = {};
  for (const [id, detail] of Object.entries(detailed)) prices[id] = detail.unitPriceKamas;
  return { prices, communityUnavailable };
}

export function useRunePrices(serverId: string | undefined, priceMode: PriceMode, ids: string[]): RunePricesState {
  const key = serverId ? `${serverId}:${priceMode}:${ids.join(',')}` : undefined;
  const [loaded, setLoaded] = useState<{ key: string; state: RunePricesState }>();
  useEffect(() => {
    if (!serverId || !key) return;
    let cancelled = false;
    loadPrices(serverId, priceMode, ids)
      .then((result) => { if (!cancelled) setLoaded({ key, state: { status: 'ready', ...result } }); })
      .catch(() => { if (!cancelled) setLoaded({ key, state: { status: 'ready', prices: {}, communityUnavailable: priceMode === 'community' } }); });
    return () => { cancelled = true; };
    // `ids` is covered by `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, serverId, priceMode]);
  return loaded && loaded.key === key ? loaded.state : LOADING;
}
