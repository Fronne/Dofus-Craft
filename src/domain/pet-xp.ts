import petXpData from '../data/pet-xp-data.json';
import { pickLotPrice, type LotSize, type LotUnitPrices, type PickedLotPrice } from './lot-price';

// specs/022-pet-xp-calculator: pet XP rules. The per-resource XP (Tenmalexis' XP Familier list,
// https://tenmalexis.github.io/xp-familier/) and the level curve (game client) are frozen in src/data/pet-xp-data.json
// (research.md §1-§3); everything here is pure so it can be tested on its own (constitution, principe II).

export type PetFood = {
  itemId: string;
  name: string;
  imageUrl?: string;
  /** XP one unit gives the pet. */
  xpPerUnit: number;
  sourceName: string;
};

/** What the player types (FR-002, revised 2026-09-28): the pet's total XP and the level aimed for. */
export type PetLevelsInput = { totalXp: number; targetLevel: number };

/**
 * `unitPriceKamas` is the price of the lot of 1 (the carnet's, or the latest shared one); `lots` are the
 * unit prices seen per lot size on the HDV (specs/058-prix-par-lot), community mode only.
 */
export type PetFoodPrice = { unitPriceKamas: number; date?: string; origin: 'carnet' | 'community-latest'; lots?: LotUnitPrices };

const hasAnyPrice = (price: PetFoodPrice | undefined): price is PetFoodPrice =>
  !!price && (price.unitPriceKamas > 0 || Object.values(price.lots ?? {}).some((lot) => (lot?.unitPriceKamas ?? 0) > 0));

/**
 * The price of the lot that buys `quantity` units (specs/058-prix-par-lot): the biggest lot not above the
 * quantity that has a price, down to the lot of 1, which falls back to `unitPriceKamas`.
 */
export function priceForQuantity(price: PetFoodPrice, quantity: number): PickedLotPrice | undefined {
  const single = price.unitPriceKamas > 0 ? { unitPriceKamas: price.unitPriceKamas, date: price.date } : undefined;
  return pickLotPrice(quantity, { ...(single && { 1: single }), ...price.lots });
}

export type PetFoodRecommendation = {
  food: PetFood;
  /** XP one unit actually gives, bonus included (FR-012). */
  xpPerUnit: number;
  unitPriceKamas: number;
  /** The HDV lot size whose price this is (specs/058-prix-par-lot). */
  lotSize: LotSize;
  priceDate?: string;
  priceOrigin: PetFoodPrice['origin'];
  quantity: number;
  totalKamas: number;
};

export type PetFoodSortKey = 'name' | 'xpPerUnit' | 'unitPrice' | 'quantity' | 'total';
export type PetFoodSort = { key: PetFoodSortKey; direction: 'asc' | 'desc' };
export const DEFAULT_PET_FOOD_SORT: PetFoodSort = { key: 'total', direction: 'asc' };

const SORT_VALUE: Record<Exclude<PetFoodSortKey, 'name'>, (line: PetFoodRecommendation) => number> = {
  xpPerUnit: (line) => line.xpPerUnit,
  unitPrice: (line) => line.unitPriceKamas,
  quantity: (line) => line.quantity,
  total: (line) => line.totalKamas,
};

function compareLines(a: PetFoodRecommendation, b: PetFoodRecommendation, sort: PetFoodSort): number {
  const byName = a.food.name.localeCompare(b.food.name, 'fr');
  const value = sort.key === 'name' ? byName : SORT_VALUE[sort.key](a) - SORT_VALUE[sort.key](b);
  // Ties always fall back to the cheapest total, then the name.
  return (sort.direction === 'asc' ? value : -value) || a.totalKamas - b.totalKamas || byName;
}

export type PetFoodPlan = { xpNeeded: number; recommendations: PetFoodRecommendation[]; unpricedCount: number };

export const PET_XP_CURVE: readonly number[] = petXpData.cumulativeXpByLevel;
export const PET_FOODS: readonly PetFood[] = petXpData.foods;
export const PET_XP_SOURCE = { name: petXpData.source, url: petXpData.sourceUrl, curve: petXpData.curveSource, retrievedAt: petXpData.retrievedAt };

// The curve is indexed by level: a new pet is level 0 with 0 XP, level 100 is the last one.
export const PET_MIN_LEVEL = 0;
export const PET_MAX_LEVEL = PET_XP_CURVE.length - 1;
export const MAX_RECOMMENDATIONS = 10;

// specs/022 FR-012: the Almanax of 23 July (the same date every year) gives pets 50 % more XP.
export const ALMANAX_PET_XP_MULTIPLIER = 1.5;

/** Whether `date` (the device's local date) is 23 July, the day of the pet XP Almanax. */
export function isPetXpAlmanaxDay(date: Date = new Date()): boolean {
  return date.getMonth() === 6 && date.getDate() === 23;
}

const cumulativeXp = (level: number, curve: readonly number[]) => curve[level];

/** XP to go from `level` to `level + 1`. */
export function xpBetweenLevels(level: number, curve: readonly number[] = PET_XP_CURVE): number {
  return cumulativeXp(level + 1, curve) - cumulativeXp(level, curve);
}

/** Highest total XP a pet can have: the one of the last level. */
export function maxTotalXp(curve: readonly number[] = PET_XP_CURVE): number {
  return curve[curve.length - 1];
}

/**
 * The level a pet with `totalXp` has reached — the highest level whose cumulative XP is not above it —
 * and the XP it already holds inside that level (FR-002).
 */
export function levelForTotalXp(totalXp: number, curve: readonly number[] = PET_XP_CURVE): { level: number; xpInLevel: number } {
  let level = 0;
  while (level < curve.length - 1 && curve[level + 1] <= totalXp) level += 1;
  return { level, xpInLevel: totalXp - curve[level] };
}

export type PetLevelsErrors = Partial<Record<keyof PetLevelsInput, string>>;

export function validatePetLevels(input: PetLevelsInput, curve: readonly number[] = PET_XP_CURVE): PetLevelsErrors {
  const errors: PetLevelsErrors = {};
  const maxLevel = curve.length - 1;
  const { totalXp, targetLevel } = input;
  if (!Number.isInteger(totalXp) || totalXp < 0 || totalXp > maxTotalXp(curve)) {
    errors.totalXp = `Nombre entier entre 0 et ${new Intl.NumberFormat('fr-FR').format(maxTotalXp(curve))}.`;
  }
  if (!Number.isInteger(targetLevel) || targetLevel < PET_MIN_LEVEL + 1 || targetLevel > maxLevel) {
    errors.targetLevel = `Niveau entre ${PET_MIN_LEVEL + 1} et ${maxLevel}.`;
  }
  return errors;
}

/** XP still to give to reach `targetLevel`; 0 when the pet already has that much. */
export function xpNeeded(input: PetLevelsInput, curve: readonly number[] = PET_XP_CURVE): number {
  return Math.max(0, cumulativeXp(input.targetLevel, curve) - input.totalXp);
}

/** Units of `food` to give for `xp` points, rounded up so the level is always reached. */
export function quantityFor(xp: number, food: PetFood, xpMultiplier = 1): number {
  const exact = xp / (food.xpPerUnit * xpMultiplier);
  // xpPerUnit is decimal (0,075, 2,646…): absorb floating-point noise before rounding up.
  return Math.ceil(Math.round(exact * 1e9) / 1e9);
}

/** Foods for `xp` points: priced foods only, sorted by `sort` (cheapest total first by default, research.md §5), then cut to `limit`. */
export function planPetFood(
  xp: number,
  foods: readonly PetFood[],
  prices: Record<string, PetFoodPrice | undefined>,
  limit = MAX_RECOMMENDATIONS,
  sort: PetFoodSort = DEFAULT_PET_FOOD_SORT,
  /** 1.5 with the Almanax of 23 July (FR-012), 1 otherwise. */
  xpMultiplier = 1,
): PetFoodPlan {
  const priced = foods.filter((food) => hasAnyPrice(prices[food.itemId]));
  const unpricedCount = foods.length - priced.length;
  if (xp <= 0) return { xpNeeded: 0, recommendations: [], unpricedCount };
  const recommendations = priced
    .flatMap((food): PetFoodRecommendation[] => {
      const price = prices[food.itemId]!;
      const quantity = quantityFor(xp, food, xpMultiplier);
      const lot = priceForQuantity(price, quantity);
      if (!lot) return [];
      return [{
        food,
        xpPerUnit: food.xpPerUnit * xpMultiplier,
        unitPriceKamas: lot.unitPriceKamas,
        lotSize: lot.lotSize,
        priceDate: lot.date,
        priceOrigin: price.origin,
        quantity,
        totalKamas: Math.round(quantity * lot.unitPriceKamas),
      }];
    })
    .sort((a, b) => compareLines(a, b, sort))
    .slice(0, limit);
  return { xpNeeded: xp, recommendations, unpricedCount };
}

// specs/022 FR-008b (2026-09-29): above this many units, a cheap food's price is out of reach — the
// auction house never holds that much at it — so the line is hidden unless the player raises the cap.
export const DEFAULT_PET_FOOD_MAX_QUANTITY = 50_000;

/** Splits `lines` into the ones needing at most `maxQuantity` units and how many are hidden; no cap when `maxQuantity` is undefined. */
export function capPetFoodQuantity(
  lines: readonly PetFoodRecommendation[],
  maxQuantity: number | undefined,
): { shown: PetFoodRecommendation[]; hiddenCount: number } {
  if (maxQuantity === undefined) return { shown: [...lines], hiddenCount: 0 };
  const shown = lines.filter((line) => line.quantity <= maxQuantity);
  return { shown, hiddenCount: lines.length - shown.length };
}

// specs/055-refonte-xp-familier: what the redesigned page shows on top of the 022 rules — the pet's
// progress, one ranking shared by the podium, the table and the targeted resource, and that resource's
// card (data-model.md). Nothing here changes how a quantity or a cost is computed.

export type PetXpProgress = { level: number; totalXp: number; percent: number };

/** Where a pet with `totalXp` stands on the way to the last level, as a percentage rounded to 0.1. */
export function petXpProgress(totalXp: number, curve: readonly number[] = PET_XP_CURVE): PetXpProgress {
  return {
    level: levelForTotalXp(totalXp, curve).level,
    totalXp,
    percent: Math.round((totalXp / maxTotalXp(curve)) * 1000) / 10,
  };
}

export type RankedPetFood = PetFoodRecommendation & { rank: number };

/** Every priced food for `xp` points, cheapest total first, without the ones above `maxQuantity`, numbered from 1. */
export function rankPetFoods(
  xp: number,
  foods: readonly PetFood[],
  prices: Record<string, PetFoodPrice | undefined>,
  maxQuantity: number | undefined,
  xpMultiplier = 1,
): RankedPetFood[] {
  const plan = planPetFood(xp, foods, prices, Number.POSITIVE_INFINITY, DEFAULT_PET_FOOD_SORT, xpMultiplier);
  return capPetFoodQuantity(plan.recommendations, maxQuantity).shown.map((line, index) => ({ ...line, rank: index + 1 }));
}

export const PET_FOOD_PODIUM_SIZE = 3;

export type PetFoodPodiumEntry = RankedPetFood & { gapKamas: number };

/** The first foods of `ranked`, each with how much more it costs than the cheapest. */
export function petFoodPodium(ranked: readonly RankedPetFood[]): PetFoodPodiumEntry[] {
  return ranked.slice(0, PET_FOOD_PODIUM_SIZE).map((line) => ({ ...line, gapKamas: line.totalKamas - ranked[0].totalKamas }));
}

export type PetFoodStanding =
  | { kind: 'ranked'; rank: number; gapPercent: number }
  | { kind: 'capped'; maxQuantity: number }
  | { kind: 'unpriced' };

export type PetFoodTarget = {
  food: PetFood;
  xpPerUnit: number;
  quantity: number;
  /** Share of the XP to give that one unit brings, at most 100. */
  sharePercent: number;
  price?: { unitPriceKamas: number; lotSize: LotSize; date?: string; totalKamas: number };
  standing: PetFoodStanding;
};

/** The card of one food the player aims at: its figures for `xp` points and where it stands in `ranked`. */
export function petFoodTarget(
  food: PetFood,
  xp: number,
  prices: Record<string, PetFoodPrice | undefined>,
  ranked: readonly RankedPetFood[],
  maxQuantity: number | undefined,
  xpMultiplier = 1,
): PetFoodTarget {
  const xpPerUnit = food.xpPerUnit * xpMultiplier;
  const quantity = quantityFor(xp, food, xpMultiplier);
  const sharePercent = Math.min(100, (xpPerUnit / xp) * 100);
  const foodPrice = prices[food.itemId];
  const lot = foodPrice ? priceForQuantity(foodPrice, quantity) : undefined;
  if (!lot) return { food, xpPerUnit, quantity, sharePercent, standing: { kind: 'unpriced' } };
  const totalKamas = Math.round(quantity * lot.unitPriceKamas);
  const price = { unitPriceKamas: lot.unitPriceKamas, lotSize: lot.lotSize, date: lot.date, totalKamas };
  const line = ranked.find((entry) => entry.food.itemId === food.itemId);
  const standing: PetFoodStanding = line
    ? { kind: 'ranked', rank: line.rank, gapPercent: Math.round(((totalKamas - ranked[0].totalKamas) / ranked[0].totalKamas) * 1000) / 10 }
    : { kind: 'capped', maxQuantity: maxQuantity ?? quantity };
  return { food, xpPerUnit, quantity, sharePercent, price, standing };
}

const shareFormat = new Intl.NumberFormat('fr-FR', { maximumSignificantDigits: 2 });

/** A rank as French writes it: « 1re », « 2e », « 10e ». */
export const ordinal = (rank: number) => `${rank}${rank === 1 ? 're' : 'e'}`;

/** The share of the objective one unit brings, with 2 significant digits (« 0,019 »), research.md §4. */
export function formatObjectiveShare(percent: number): string {
  return shareFormat.format(percent);
}
