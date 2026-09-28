import type { ResourcePrice, ServerId } from '../../domain/types';
import { pickCommunityPrice } from '../../domain/community-price-choice';
import { lookupCommunityPrice } from './useCommunityPrice';

// specs/024-latest-community-price (FR-004, FR-007): Mode communautaire, for every resource in
// `resourceIds`, reads the latest shared price and hands it to `save` — with its own date — when it
// is more recent than the carnet's entry in `prices` (or there is none). The caller decides how it's
// written (the Suivis and Rentabilité pages straight into the repository, the item detail through its
// own price hook so the lines refresh). Shared so every page counts the same prices, including
// resources whose line isn't displayed (specs/015, research.md §7). All reads start in the same tick,
// so they leave grouped (specs/021). A saved price that comes back is also put into `prices`, so the
// caller can recompute right away. Returns whether any was saved.
export async function syncCommunityPrices(
  serverId: ServerId,
  resourceIds: string[],
  prices: Record<string, ResourcePrice>,
  save: (resourceId: string, amountKamas: number, updatedAt: string) => Promise<ResourcePrice | void>,
  isCancelled: () => boolean,
): Promise<boolean> {
  let saved = false;
  await Promise.all([...new Set(resourceIds)].map(async (resourceId) => {
    const shared = await lookupCommunityPrice(resourceId, serverId);
    if (!shared || isCancelled()) return;
    const choice = pickCommunityPrice(prices[resourceId], { amountKamas: shared.latestAmountKamas, contributedAt: shared.latestContributionAt });
    if (!choice.replacesCarnet) return;
    const price = await save(resourceId, shared.latestAmountKamas, shared.latestContributionAt);
    prices[resourceId] = price ?? { resourceId, unitPriceKamas: shared.latestAmountKamas, updatedAt: shared.latestContributionAt };
    saved = true;
  }));
  return saved;
}
