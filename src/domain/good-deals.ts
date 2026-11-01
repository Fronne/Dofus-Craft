import { brisageStat } from './brisage';

// specs/078-bons-plans-hdv (research R2–R4): the "bons plans" of the HDV. A copy of an equipment is a
// good deal when it asks at least `threshold` % less than copies of the same item with a close roll.
// Pure rules, no network: the Worker only serves the fresh listings.
// specs/079-calcul-bons-plans: the market rules given by the site's owner (exo tier, importance of a stat, gap to the max).

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

/** The theoretical roll of a stat, "min à max" as in game ("min" alone when fixed); undefined for an exo or a stat with no known bounds. */
export function theoreticalRange(effectId: number, itemEffects: ItemEffect[]): string | undefined {
  const effect = itemEffects.find((candidate) => candidate.effectId === effectId);
  if (!effect || (effect.from === undefined && effect.to === undefined)) return undefined;
  const low = Math.min(effect.from ?? effect.to!, effect.to ?? effect.from!);
  const high = Math.max(effect.from ?? effect.to!, effect.to ?? effect.from!);
  return low === high ? `${low}` : `${low} à ${high}`;
}

// The malus effects seen on the announcements, by the effect of the stat they lower (DofusDB, oppositeId).
// They have no brisage weight, so the quality ignores them: only the card names them.
const MALUS_OF_STAT: Record<number, number> = {
  101: 111, 127: 128, 116: 117, 2990: 182, 171: 115, 175: 174, 754: 752, 755: 753, 162: 160, 163: 161, 411: 410, 413: 412,
  415: 414, 417: 416, 419: 418, 421: 420, 423: 422, 215: 210, 216: 211, 218: 213, 219: 214,
};
const LOCKED_EFFECT = 2825;

export type JetLineText = { text: string; iconEffectId: number; isMalus: boolean };

/** How a line of an announcement reads on its card; a malus shows its stat with a minus sign. */
export function describeJetLine(line: JetLine): JetLineText {
  if (line.effectId === LOCKED_EFFECT) return { text: 'Empêche les futures forgemagies', iconEffectId: line.effectId, isMalus: false };
  const lowered = MALUS_OF_STAT[line.effectId];
  const statName = (value: string) => {
    const label = brisageStat(lowered ?? line.effectId)?.label ?? `Effet ${line.effectId}`;
    // As in game: "3% Critique", not "3 Critique (%)".
    return label.endsWith(' (%)') ? `${value}% ${label.slice(0, -4)}` : `${value} ${label}`;
  };
  if (lowered === undefined) return { text: statName(`${line.value}`), iconEffectId: line.effectId, isMalus: false };
  return { text: statName(`−${line.value}`), iconEffectId: lowered, isMalus: true };
}

export type JetCardLine = JetLineText & {
  effectId: number;
  tone: 'normal' | 'exo' | 'malus' | 'muted';
  range?: string;
};

/**
 * The lines of a card, in the order of the game: what the item rolls (a line the copy lacks shows at 0),
 * then the exos, the maluses, and whatever else the announcement carries.
 */
export function jetCardLines(stats: JetLine[], itemEffects: ItemEffect[]): JetCardLine[] {
  const rolled = itemEffects
    .filter((effect) => brisageStat(effect.effectId))
    .map((effect): JetCardLine => {
      const value = stats.find((line) => line.effectId === effect.effectId)?.value ?? 0;
      const text = describeJetLine({ effectId: effect.effectId, value });
      return { ...text, effectId: effect.effectId, tone: value === 0 ? 'muted' : 'normal', range: theoreticalRange(effect.effectId, itemEffects) };
    });
  const extras = stats
    .filter((line) => !rolled.some((rolledLine) => rolledLine.effectId === line.effectId))
    .map((line): JetCardLine => {
      const text = describeJetLine(line);
      const tone = text.isMalus ? 'malus' : brisageStat(line.effectId) ? 'exo' : 'muted';
      return { ...text, effectId: line.effectId, tone };
    });
  const ofTone = (tone: JetCardLine['tone']) => extras.filter((line) => line.tone === tone);
  return [...rolled, ...ofTone('exo'), ...ofTone('malus'), ...ofTone('muted')];
}

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
/** specs/079: from this brisage weight (value × weight of the stat) an exo is far harder to make, whatever the stat. */
export const EXO_WEIGHT_TIER = 30;

/**
 * specs/079 (FR-004): what a stat counts for the players, apart from its brisage weight. A starting ESTIMATE
 * to adjust on real listings; a known stat left out of this table counts 1.
 */
export const STAT_IMPORTANCE: Record<number, number> = {
  // Primordial: PA, PM, Portée, Invocations, Critique.
  111: 1.5, 128: 1.5, 117: 1.5, 182: 1.5, 115: 1.5,
  // Medium: Fuite, Tacle, Esquive PA/PM, Retrait PA/PM, Dommages Poussée.
  752: 0.5, 753: 0.5, 160: 0.5, 161: 0.5, 410: 0.5, 412: 0.5, 414: 0.5,
  // Low: Sagesse, Prospection, Pods, Initiative, Soins, fixed resistances (Critiques and Poussée included).
  124: 0.25, 176: 0.25, 158: 0.25, 174: 0.25, 178: 0.25, 240: 0.25, 241: 0.25, 242: 0.25, 243: 0.25, 244: 0.25, 416: 0.25, 420: 0.25,
  // None: Dommages Renvoyés, Dommages Pièges, Puissance Pièges, Arme de chasse.
  220: 0, 225: 0, 226: 0, 795: 0,
};

// specs/079 (FR-009): how far under the item's max a line stays worth its roll, per group of stats.
const GAP_OF_5 = new Set([118, 126, 123, 119, 138, 430]); // Force, Intelligence, Chance, Agilité, Puissance, Dommages Neutre
const GAP_OF_1 = new Set([112, 422, 424, 426, 428, 2800, 2804, 2808, 2812, 210, 211, 212, 213, 214, 2803, 2807]); // other damages, % resistances
const GAP_OF_0 = new Set([115, 111, 128, 117, 182]); // Critique, PA, PM, Portée, Invocations
const DOMMAGES_CRITIQUES = 418;
const VITALITE = 125;

/** The gap accepted under the item's `max`; undefined for a stat that is never a defect. */
export function acceptedGap(effectId: number, max: number): number | undefined {
  if (GAP_OF_5.has(effectId)) return 5;
  if (GAP_OF_1.has(effectId)) return 1;
  if (GAP_OF_0.has(effectId)) return 0;
  if (effectId === DOMMAGES_CRITIQUES) return max > 20 ? 2 : 1;
  if (effectId === VITALITE) return Math.max(12, max * 0.075);
  return undefined;
}

export type JetQuality = {
  quality: number;
  unknownLines: number;
  exoEffectIds: number[];
  /** Each exo and its side of EXO_WEIGHT_TIER, as "effectId:high" or "effectId:low". */
  exoTiers: string[];
  /** The rolled stats further under the item's max than acceptedGap. */
  defectEffectIds: number[];
};

// specs/079 (FR-008): a line the copy lacks counts 0; bounds the item doesn't know make no defect.
function jetDefects(stats: JetLine[], itemEffects: ItemEffect[]): number[] {
  const defects: number[] = [];
  for (const effect of itemEffects) {
    if (effect.from === undefined && effect.to === undefined) continue;
    const max = Math.max(effect.from ?? effect.to!, effect.to ?? effect.from!);
    const gap = acceptedGap(effect.effectId, max);
    if (gap === undefined) continue;
    const value = stats.find((line) => line.effectId === effect.effectId)?.value ?? 0;
    if (value < max - gap) defects.push(effect.effectId);
  }
  return defects.sort((a, b) => a - b);
}

/** Sum of value × weight × importance of each line; an exo line counts EXO_FACTOR times; a stat without a weight counts for nothing. */
export function jetQuality(stats: JetLine[], itemEffects: ItemEffect[]): JetQuality {
  const normal = new Set(itemEffects.map((effect) => effect.effectId));
  let quality = 0;
  let unknownLines = 0;
  const exoEffectIds: number[] = [];
  const exoTiers: string[] = [];
  for (const line of stats) {
    const known = brisageStat(line.effectId);
    // A line of an unknown stat can't be priced, so it is neither an exo nor part of the quality.
    if (!known) {
      unknownLines += 1;
      continue;
    }
    const isExo = !normal.has(line.effectId);
    if (isExo && !exoEffectIds.includes(line.effectId)) {
      exoEffectIds.push(line.effectId);
      // The tier is about how hard the exo is to make, so it stays on the brisage weight, without the importance.
      exoTiers.push(`${line.effectId}:${line.value * known.weight >= EXO_WEIGHT_TIER ? 'high' : 'low'}`);
    }
    quality += line.value * known.weight * (isExo ? EXO_FACTOR : 1) * (STAT_IMPORTANCE[line.effectId] ?? 1);
  }
  return {
    quality,
    unknownLines,
    exoEffectIds: exoEffectIds.sort((a, b) => a - b),
    exoTiers: exoTiers.sort(),
    defectEffectIds: jetDefects(stats, itemEffects),
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

const sameList = <T,>(a: T[], b: T[]) => a.length === b.length && a.every((entry, index) => entry === b[index]);

/**
 * Judges every copy of ONE item on ONE server. The reference of a copy is the median, over its comparable
 * copies, of their price scaled by the ratio of the qualities: a better roll at the same price is a deal.
 * Comparable = same exos on the same side of EXO_WEIGHT_TIER, same defects, quality within NEIGHBOUR_RANGE,
 * at least MIN_NEIGHBOURS of them.
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
      && sameList(other.exoTiers, entry.exoTiers)
      && sameList(other.defectEffectIds, entry.defectEffectIds)
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
