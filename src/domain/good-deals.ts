import { brisageStat } from './brisage';

// specs/078-bons-plans-hdv (research R2–R4): the "bons plans" of the HDV. A copy of an equipment is a
// good deal when it asks at least `threshold` % less than copies of the same item with a close roll.
// Pure rules, no network: the Worker only serves the fresh listings.

/** A copy of an equipment on sale, as GET /bons-plans serves it. */
export type Listing = {
  listingId: string;
  itemId: string;
  priceKamas: number;
  stats: JetLine[];
  /** ISO 8601; absent in tests. */
  lastSeenAt?: string;
};

export type JetLine = { effectId: number; value: number };

/** The effects the item can roll normally; a line outside them is an exo. */
export type ItemEffect = { effectId: number; from?: number; to?: number };

export type DealVerdict = {
  listingId: string;
  itemId: string;
  priceKamas: number;
  /** The price the copy would ask on the market, median of its comparable copies scaled to its roll. Absent when not judged. */
  referencePriceKamas?: number;
  savingKamas: number;
  savingPercent: number;
  neighbourCount: number;
  isGoodDeal: boolean;
  hasExo: boolean;
  exoEffectIds: number[];
  /** Lines of a stat with no known weight, ignored in the quality. */
  unknownLines: number;
  quality: number;
};

/** An exo is worth more than a normal line of the same weight. */
export const EXO_FACTOR = 1.5;
/** A copy is comparable when its quality is within this share of the judged copy's. */
export const NEIGHBOUR_RANGE = 0.25;
/** Fewer comparable copies than this and nothing is judged: one odd price could be the whole reference. */
export const MIN_NEIGHBOURS = 3;
export const DEFAULT_THRESHOLD_PERCENT = 25;
/** The bounds of the threshold the owner can set, in percent. */
export const MIN_THRESHOLD = 5;
export const MAX_THRESHOLD = 90;
/** An announcement not seen since this long is no longer proposed. */
export const MAX_AGE_HOURS = 24;

export type JetQuality = { quality: number; unknownLines: number; exoEffectIds: number[] };

/** Sum of value × weight of each line; an exo line counts EXO_FACTOR times; a stat without a weight counts for nothing. */
export function jetQuality(stats: JetLine[], itemEffects: ItemEffect[]): JetQuality {
  const normal = new Set(itemEffects.map((effect) => effect.effectId));
  let quality = 0;
  let unknownLines = 0;
  const exoEffectIds: number[] = [];
  for (const line of stats) {
    const known = brisageStat(line.effectId);
    // A line of an unknown stat can't be priced, so it is neither an exo nor part of the quality.
    if (!known) {
      unknownLines += 1;
      continue;
    }
    const isExo = !normal.has(line.effectId);
    if (isExo && !exoEffectIds.includes(line.effectId)) exoEffectIds.push(line.effectId);
    quality += line.value * known.weight * (isExo ? EXO_FACTOR : 1);
  }
  return { quality, unknownLines, exoEffectIds: exoEffectIds.sort((a, b) => a - b) };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

const sameExos = (a: number[], b: number[]) => a.length === b.length && a.every((id, index) => id === b[index]);

/**
 * Judges every copy of ONE item on ONE server. The reference of a copy is the median, over its comparable
 * copies, of their price scaled by the ratio of the qualities: a better roll at the same price is a deal.
 * Comparable = same exos, quality within NEIGHBOUR_RANGE, at least MIN_NEIGHBOURS of them.
 */
export function evaluateListings(listings: Listing[], itemEffects: ItemEffect[], thresholdPercent: number): DealVerdict[] {
  const rated = listings.map((listing) => ({ listing, ...jetQuality(listing.stats, itemEffects) }));
  return rated.map((entry) => {
    const base: DealVerdict = {
      listingId: entry.listing.listingId,
      itemId: entry.listing.itemId,
      priceKamas: entry.listing.priceKamas,
      savingKamas: 0,
      savingPercent: 0,
      neighbourCount: 0,
      isGoodDeal: false,
      hasExo: entry.exoEffectIds.length > 0,
      exoEffectIds: entry.exoEffectIds,
      unknownLines: entry.unknownLines,
      quality: entry.quality,
    };
    if (!(entry.quality > 0)) return base;
    const neighbours = rated.filter((other) =>
      other !== entry
      && other.quality > 0
      && sameExos(other.exoEffectIds, entry.exoEffectIds)
      && Math.abs(other.quality - entry.quality) <= NEIGHBOUR_RANGE * entry.quality);
    base.neighbourCount = neighbours.length;
    if (neighbours.length < MIN_NEIGHBOURS) return base;
    const reference = median(neighbours.map((other) => (other.listing.priceKamas * entry.quality) / other.quality));
    const price = entry.listing.priceKamas;
    base.referencePriceKamas = Math.round(reference);
    base.savingKamas = Math.round(reference - price);
    base.savingPercent = reference > 0 ? Math.round(((reference - price) / reference) * 100) : 0;
    // Integer-style comparison: a copy exactly on the threshold is a deal.
    base.isGoodDeal = price * 100 <= reference * (100 - thresholdPercent) + 1e-6;
    return base;
  });
}

/** True when the announcement was seen within MAX_AGE_HOURS of `now`; one without a date is not proposed. */
export function isFresh(listing: Listing, now: Date): boolean {
  if (!listing.lastSeenAt) return false;
  const seen = Date.parse(listing.lastSeenAt);
  return Number.isFinite(seen) && now.getTime() - seen < MAX_AGE_HOURS * 3_600_000;
}

export type DealSort = 'savingKamas' | 'savingPercent';
export const DEAL_SORTS: { id: DealSort; label: string }[] = [
  { id: 'savingKamas', label: 'Économie en kamas' },
  { id: 'savingPercent', label: 'Économie en pourcentage' },
];

export type DealFilter = { sort: DealSort; exoOnly: boolean; effectId?: number };

/** The good deals only, filtered (exo, a given stat) and sorted by saving, biggest first. */
export function selectGoodDeals<T extends DealVerdict & { listing: Listing }>(deals: T[], filter: DealFilter): T[] {
  return deals
    .filter((deal) => deal.isGoodDeal)
    .filter((deal) => !filter.exoOnly || deal.hasExo)
    .filter((deal) => filter.effectId === undefined || deal.listing.stats.some((line) => line.effectId === filter.effectId))
    .sort((a, b) => b[filter.sort] - a[filter.sort] || a.priceKamas - b.priceKamas);
}
