import petXpData from '../data/pet-xp-data.json';

// specs/022-pet-xp-calculator: pet XP rules. The curve and the per-resource XP come from the Dofus
// Tool community tables frozen in src/data/pet-xp-data.json (research.md §1-§3); everything here is
// pure so it can be tested on its own (constitution, principe II).

export type PetFood = {
  itemId: string;
  name: string;
  imageUrl?: string;
  xpGiven: number;
  quantityNeeded: number;
  sourceName: string;
};

export type PetLevelsInput = { currentLevel: number; xpInLevel: number; targetLevel: number };

export type PetFoodPrice = { unitPriceKamas: number; date?: string; origin: 'carnet' | 'community-median' };

export type PetFoodRecommendation = {
  food: PetFood;
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
  xpPerUnit: (line) => xpPerUnit(line.food),
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
export const PET_XP_SOURCE = { name: petXpData.source, url: petXpData.sourceUrl, retrievedAt: petXpData.retrievedAt };

export const PET_MIN_LEVEL = 1;
export const PET_MAX_LEVEL = PET_XP_CURVE.length;
export const MAX_RECOMMENDATIONS = 10;

const cumulativeXp = (level: number, curve: readonly number[]) => curve[level - 1];

/** XP to go from `level` to `level + 1`. */
export function xpBetweenLevels(level: number, curve: readonly number[] = PET_XP_CURVE): number {
  return cumulativeXp(level + 1, curve) - cumulativeXp(level, curve);
}

/** Highest XP a pet can hold inside `level` without reaching the next one. */
export function maxXpInLevel(level: number, curve: readonly number[] = PET_XP_CURVE): number {
  return xpBetweenLevels(level, curve) - 1;
}

export type PetLevelsErrors = Partial<Record<keyof PetLevelsInput, string>>;

export function validatePetLevels(input: PetLevelsInput, curve: readonly number[] = PET_XP_CURVE): PetLevelsErrors {
  const errors: PetLevelsErrors = {};
  const maxLevel = curve.length;
  const { currentLevel, xpInLevel, targetLevel } = input;
  if (!Number.isInteger(currentLevel) || currentLevel < PET_MIN_LEVEL || currentLevel > maxLevel - 1) {
    errors.currentLevel = `Niveau entre ${PET_MIN_LEVEL} et ${maxLevel - 1}.`;
  }
  if (!Number.isInteger(targetLevel) || targetLevel < PET_MIN_LEVEL + 1 || targetLevel > maxLevel) {
    errors.targetLevel = `Niveau entre ${PET_MIN_LEVEL + 1} et ${maxLevel}.`;
  }
  if (!Number.isInteger(xpInLevel) || xpInLevel < 0) {
    errors.xpInLevel = 'Nombre entier positif ou nul.';
  } else if (!errors.currentLevel && xpInLevel > maxXpInLevel(currentLevel, curve)) {
    errors.xpInLevel = `Au plus ${maxXpInLevel(currentLevel, curve)} XP dans ce niveau.`;
  }
  return errors;
}

/** XP still to give to reach `targetLevel`; 0 when the target isn't above the current level. */
export function xpNeeded(input: PetLevelsInput, curve: readonly number[] = PET_XP_CURVE): number {
  if (input.targetLevel <= input.currentLevel) return 0;
  return Math.max(0, cumulativeXp(input.targetLevel, curve) - (cumulativeXp(input.currentLevel, curve) + input.xpInLevel));
}

export const xpPerUnit = (food: PetFood) => food.xpGiven / food.quantityNeeded;

/** Units of `food` to give for `xp` points, rounded up so the level is always reached. */
export function quantityFor(xp: number, food: PetFood): number {
  const exact = (xp * food.quantityNeeded) / food.xpGiven;
  // xpGiven can be decimal (1,25): absorb floating-point noise before rounding up.
  return Math.ceil(Math.round(exact * 1e9) / 1e9);
}

/** Foods for `xp` points: priced foods only, sorted by `sort` (cheapest total first by default, research.md §5), then cut to `limit`. */
export function planPetFood(
  xp: number,
  foods: readonly PetFood[],
  prices: Record<string, PetFoodPrice | undefined>,
  limit = MAX_RECOMMENDATIONS,
  sort: PetFoodSort = DEFAULT_PET_FOOD_SORT,
): PetFoodPlan {
  const priced = foods.filter((food) => (prices[food.itemId]?.unitPriceKamas ?? 0) > 0);
  const unpricedCount = foods.length - priced.length;
  if (xp <= 0) return { xpNeeded: 0, recommendations: [], unpricedCount };
  const recommendations = priced
    .map((food): PetFoodRecommendation => {
      const price = prices[food.itemId]!;
      const quantity = quantityFor(xp, food);
      return {
        food,
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
