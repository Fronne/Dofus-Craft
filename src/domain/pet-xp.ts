import petXpData from '../data/pet-xp-data.json';

// specs/022-pet-xp-calculator: pet XP rules. The per-resource XP (Dafous, via the player's EXCEL
// FAMILIER workbook) and the level curve (game client) are frozen in src/data/pet-xp-data.json
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

export type PetFoodPrice = { unitPriceKamas: number; date?: string; origin: 'carnet' | 'community-latest' };

export type PetFoodRecommendation = {
  food: PetFood;
  /** XP one unit actually gives, bonus included (FR-012). */
  xpPerUnit: number;
  unitPriceKamas: number;
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
  const priced = foods.filter((food) => (prices[food.itemId]?.unitPriceKamas ?? 0) > 0);
  const unpricedCount = foods.length - priced.length;
  if (xp <= 0) return { xpNeeded: 0, recommendations: [], unpricedCount };
  const recommendations = priced
    .map((food): PetFoodRecommendation => {
      const price = prices[food.itemId]!;
      const quantity = quantityFor(xp, food, xpMultiplier);
      return {
        food,
        xpPerUnit: food.xpPerUnit * xpMultiplier,
        unitPriceKamas: price.unitPriceKamas,
        priceDate: price.date,
        priceOrigin: price.origin,
        quantity,
        totalKamas: quantity * price.unitPriceKamas,
      };
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
