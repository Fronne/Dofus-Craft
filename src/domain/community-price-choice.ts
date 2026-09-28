import type { ResourcePrice } from './types';

export type LatestCommunityPrice = { amountKamas: number; contributedAt: string };

export type CommunityPriceChoice = {
  price: { unitPriceKamas: number; updatedAt: string } | undefined;
  /** True when the latest shared price must be written to the carnet, with its own date. */
  replacesCarnet: boolean;
};

// specs/024-latest-community-price (data-model.md): in Mode communautaire, the price of a resource is
// the one kept on the device unless the group shared a more recent one. The latest price keeps its
// own date — never the device's clock — so a price shared in between (still hidden by the 60-second
// cache) always compares as more recent than what the carnet holds (research.md §3). On an exact tie
// the kept price wins: it is the same reading, or the player's own.
export function pickCommunityPrice(carnetEntry: ResourcePrice | undefined, latest: LatestCommunityPrice | undefined): CommunityPriceChoice {
  const kept = carnetEntry ? { unitPriceKamas: carnetEntry.unitPriceKamas, updatedAt: carnetEntry.updatedAt } : undefined;
  if (!latest) return { price: kept, replacesCarnet: false };
  if (!carnetEntry || carnetEntry.updatedAt < latest.contributedAt) {
    return { price: { unitPriceKamas: latest.amountKamas, updatedAt: latest.contributedAt }, replacesCarnet: true };
  }
  return { price: kept, replacesCarnet: false };
}
