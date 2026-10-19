import { describe, expect, it } from 'vitest';
import type { LotUnitPrices } from '../../src/domain/lot-price';
import { ALMANAX_PET_XP_MULTIPLIER, DEFAULT_PET_FOOD_MAX_QUANTITY, capPetFoodQuantity, isPetXpAlmanaxDay, levelForTotalXp, planPetFood, quantityFor, validatePetLevels, xpNeeded, petXpProgress, rankPetFoods, petFoodPodium, petFoodTarget, formatObjectiveShare, type PetFood } from '../../src/domain/pet-xp';

const food = (itemId: string, name: string, xpPerUnit: number): PetFood =>
  ({ itemId, name, xpPerUnit, sourceName: name });

describe('xpNeeded', () => {
  it('computes the XP from the total XP to the target level, on the reference curve', () => {
    expect(xpNeeded({ totalXp: 0, targetLevel: 100 })).toBe(179592);
    expect(xpNeeded({ totalXp: 1703, targetLevel: 60 })).toBe(2859);
    expect(xpNeeded({ totalXp: 1853, targetLevel: 60 })).toBe(2709);
  });

  it('needs no XP when the pet already has the target level', () => {
    expect(xpNeeded({ totalXp: 4562, targetLevel: 60 })).toBe(0);
    expect(xpNeeded({ totalXp: 4562, targetLevel: 40 })).toBe(0);
  });
});

describe('levelForTotalXp', () => {
  it('deduces the highest level reached and the XP inside it', () => {
    expect(levelForTotalXp(0)).toEqual({ level: 0, xpInLevel: 0 });
    expect(levelForTotalXp(1703)).toEqual({ level: 50, xpInLevel: 0 });
    expect(levelForTotalXp(1882)).toEqual({ level: 50, xpInLevel: 179 });
    expect(levelForTotalXp(1883)).toEqual({ level: 51, xpInLevel: 0 });
    // 256 (level 32) ≤ 261 < 286 (level 33)
    expect(levelForTotalXp(261)).toEqual({ level: 32, xpInLevel: 5 });
    expect(levelForTotalXp(179592)).toEqual({ level: 100, xpInLevel: 0 });
  });
});

describe('validatePetLevels', () => {
  it('accepts a total XP between 0 and the last level, and a target level from 1 to 100', () => {
    expect(validatePetLevels({ totalXp: 0, targetLevel: 1 })).toEqual({});
    expect(validatePetLevels({ totalXp: 179592, targetLevel: 100 })).toEqual({});
  });

  it('rejects values outside the range or not integers', () => {
    expect(validatePetLevels({ totalXp: -1, targetLevel: 60 }).totalXp).toBeDefined();
    expect(validatePetLevels({ totalXp: 179593, targetLevel: 60 }).totalXp).toBeDefined();
    expect(validatePetLevels({ totalXp: 10.5, targetLevel: 60 }).totalXp).toBeDefined();
    expect(validatePetLevels({ totalXp: Number.NaN, targetLevel: 60 }).totalXp).toBeDefined();
    expect(validatePetLevels({ totalXp: 5, targetLevel: 0 }).targetLevel).toBeDefined();
    expect(validatePetLevels({ totalXp: 5, targetLevel: 101 }).targetLevel).toBeDefined();
  });
});

describe('planPetFood', () => {
  it('computes quantity and total cost for the XP needed', () => {
    const plan = planPetFood(1000, [food('1', 'Rune', 0.25)], { 1: { unitPriceKamas: 10, origin: 'carnet' } });
    expect(plan.recommendations[0]).toMatchObject({ quantity: 4000, totalKamas: 40000 });
  });

  // specs/059-prix-par-lot: the quantity is priced with the lot the rule picks, not always the singles.
  describe('lot prices', () => {
    const lots: LotUnitPrices = { 1: { unitPriceKamas: 100 }, 10: { unitPriceKamas: 90 }, 100: { unitPriceKamas: 80 }, 1000: { unitPriceKamas: 70 } };
    const withLots = (extra: LotUnitPrices = lots) => ({ '1': { unitPriceKamas: 100, origin: 'community-latest' as const, lots: extra } });

    it('prices 250 units at the lot of 100, and 5 units at the lot of 1', () => {
      const big = planPetFood(250, [food('1', 'Rune', 1)], withLots()).recommendations[0];
      expect(big).toMatchObject({ quantity: 250, lotSize: 100, unitPriceKamas: 80, totalKamas: 20000 });
      const small = planPetFood(5, [food('1', 'Rune', 1)], withLots()).recommendations[0];
      expect(small).toMatchObject({ quantity: 5, lotSize: 1, unitPriceKamas: 100, totalKamas: 500 });
    });

    it('goes down to the next lot with a price, and never up', () => {
      const noHundred = { 1: lots[1], 10: lots[10], 1000: lots[1000] };
      expect(planPetFood(250, [food('1', 'Rune', 1)], withLots(noHundred)).recommendations[0]).toMatchObject({ lotSize: 10, unitPriceKamas: 90 });
      expect(planPetFood(999, [food('1', 'Rune', 1)], withLots(noHundred)).recommendations[0]).toMatchObject({ lotSize: 10 });
    });

    it('takes the existing unit price as the lot of 1 and keeps the old behaviour without lot prices', () => {
      const plan = planPetFood(250, [food('1', 'Rune', 1)], { '1': { unitPriceKamas: 100, origin: 'carnet' } });
      expect(plan.recommendations[0]).toMatchObject({ lotSize: 1, unitPriceKamas: 100, totalKamas: 25000 });
      const onlyBig = withLots({ 100: lots[100] });
      expect(planPetFood(50, [food('1', 'Rune', 1)], onlyBig).recommendations[0]).toMatchObject({ lotSize: 1, unitPriceKamas: 100 });
    });

    it('rounds the total when a lot price is not a multiple of its size', () => {
      const plan = planPetFood(1000, [food('1', 'Rune', 1)], withLots({ 1000: { unitPriceKamas: 2.7 } }));
      expect(plan.recommendations[0]).toMatchObject({ lotSize: 1000, totalKamas: 2700 });
    });

    it('prices the targeted food the same way', () => {
      const card = petFoodTarget(food('1', 'Rune', 1), 250, withLots(), [], undefined);
      expect(card.price).toMatchObject({ lotSize: 100, unitPriceKamas: 80, totalKamas: 20000 });
    });
  });

  it('rounds the quantity up, without floating-point noise', () => {
    const pepite = food('1', 'Pépite', 1.25);
    expect(quantityFor(1000, pepite)).toBe(800);
    expect(quantityFor(1001, pepite)).toBe(801);
    expect(quantityFor(3, food('2', 'Eau', 0.1))).toBe(30);
    expect(quantityFor(2859, food('3', 'Peau de Rat', 2.646))).toBe(1081);
  });

  it('sorts by total cost then name, keeps at most 10 lines and counts unpriced foods', () => {
    const foods = Array.from({ length: 12 }, (_, index) => food(String(index), `R${String(index).padStart(2, '0')}`, 1));
    const prices = Object.fromEntries(foods.slice(0, 11).map((entry, index) => [entry.itemId, { unitPriceKamas: 20 - index, origin: 'carnet' as const }]));
    prices['0'] = { unitPriceKamas: 10, origin: 'carnet' };
    const plan = planPetFood(10, foods, prices);
    expect(plan.recommendations).toHaveLength(10);
    expect(plan.recommendations.map((line) => line.food.name).slice(0, 2)).toEqual(['R00', 'R10']);
    expect(plan.unpricedCount).toBe(1);
  });

  it('sorts the whole priced list by the chosen column before keeping the first lines', () => {
    // Rune: 1 XP / unit at 5 → 50 ; Os: 2 XP / unit at 30 → 150 ; Piou: 0,5 XP / unit at 1 → 20.
    const foods = [food('rune', 'Rune', 1), food('os', 'Os', 2), food('piou', 'Piou', 0.5)];
    const prices = { rune: { unitPriceKamas: 5, origin: 'carnet' as const }, os: { unitPriceKamas: 30, origin: 'carnet' as const }, piou: { unitPriceKamas: 1, origin: 'carnet' as const } };
    const order = (key: 'name' | 'xpPerUnit' | 'unitPrice' | 'quantity' | 'total', direction: 'asc' | 'desc', limit = 10) =>
      planPetFood(10, foods, prices, limit, { key, direction }).recommendations.map((line) => line.food.name);
    expect(order('total', 'asc')).toEqual(['Piou', 'Rune', 'Os']);
    expect(order('xpPerUnit', 'desc')).toEqual(['Os', 'Rune', 'Piou']);
    expect(order('unitPrice', 'asc')).toEqual(['Piou', 'Rune', 'Os']);
    expect(order('quantity', 'desc')).toEqual(['Piou', 'Rune', 'Os']);
    expect(order('name', 'asc')).toEqual(['Os', 'Piou', 'Rune']);
    // Sorted before the cut: the best XP per unit is kept even though it is the most expensive.
    expect(order('xpPerUnit', 'desc', 1)).toEqual(['Os']);
  });

  it('recommends nothing when no XP is needed', () => {
    expect(planPetFood(0, [food('1', 'Rune', 1)], { 1: { unitPriceKamas: 5, origin: 'carnet' } }).recommendations).toEqual([]);
  });
});

// specs/022 FR-012: the Almanax of 23 July gives pets 50 % more XP.
describe('Almanax of 23 July', () => {
  it('multiplies the XP of each unit by 1.5 before rounding the quantity up', () => {
    expect(quantityFor(1000, food('1', 'A', 2))).toBe(500);
    expect(quantityFor(1000, food('1', 'A', 2), ALMANAX_PET_XP_MULTIPLIER)).toBe(334);
    expect(quantityFor(2859, food('1', 'A', 1), ALMANAX_PET_XP_MULTIPLIER)).toBe(1906);
  });

  it('shows the boosted XP per unit and recomputes quantity and total, leaving the XP needed unchanged', () => {
    const plan = planPetFood(1000, [food('1', 'A', 2)], { '1': { unitPriceKamas: 10, origin: 'carnet' } }, 10, undefined, ALMANAX_PET_XP_MULTIPLIER);
    expect(plan.xpNeeded).toBe(1000);
    expect(plan.recommendations[0]).toMatchObject({ xpPerUnit: 3, quantity: 334, totalKamas: 3340 });
  });

  it('keeps the plain XP per unit without the bonus', () => {
    const plan = planPetFood(1000, [food('1', 'A', 2)], { '1': { unitPriceKamas: 10, origin: 'carnet' } });
    expect(plan.recommendations[0]).toMatchObject({ xpPerUnit: 2, quantity: 500 });
  });

  it('recognises 23 July, whatever the year', () => {
    expect(isPetXpAlmanaxDay(new Date(2026, 6, 23, 0, 5))).toBe(true);
    expect(isPetXpAlmanaxDay(new Date(2031, 6, 23, 23, 55))).toBe(true);
    expect(isPetXpAlmanaxDay(new Date(2026, 6, 22))).toBe(false);
    expect(isPetXpAlmanaxDay(new Date(2026, 5, 23))).toBe(false);
  });
});

// specs/022 FR-008b (2026-09-29).
describe('capPetFoodQuantity', () => {
  // 100 000 XP: 0,5 XP / unit → 200 000 units (hidden), 2 XP → 50 000 (kept, at the cap), 10 XP → 10 000.
  const plan = planPetFood(100_000, [food('a', 'Poussière', 0.5), food('b', 'Os', 2), food('c', 'Rune', 10)], {
    a: { unitPriceKamas: 1, origin: 'carnet' },
    b: { unitPriceKamas: 5, origin: 'carnet' },
    c: { unitPriceKamas: 40, origin: 'carnet' },
  }, Number.POSITIVE_INFINITY);

  it('defaults to 50 000 units', () => {
    expect(DEFAULT_PET_FOOD_MAX_QUANTITY).toBe(50_000);
  });

  it('hides the lines needing more units than the cap, keeping one exactly at it, and counts them', () => {
    const { shown, hiddenCount } = capPetFoodQuantity(plan.recommendations, 50_000);
    expect(shown.map((line) => line.food.name)).toEqual(['Os', 'Rune']);
    expect(hiddenCount).toBe(1);
  });

  it('keeps every line without a cap', () => {
    expect(capPetFoodQuantity(plan.recommendations, undefined)).toEqual({ shown: plan.recommendations, hiddenCount: 0 });
  });

  it('applies to the quantity with the Almanax (+50 % XP → fewer units)', () => {
    const almanax = planPetFood(100_000, [food('a', 'Poussière', 0.5)], { a: { unitPriceKamas: 1, origin: 'carnet' } }, Number.POSITIVE_INFINITY, undefined, ALMANAX_PET_XP_MULTIPLIER);
    expect(capPetFoodQuantity(almanax.recommendations, 150_000).hiddenCount).toBe(0);
    expect(capPetFoodQuantity(almanax.recommendations, 100_000).hiddenCount).toBe(1);
  });
});

// specs/055-refonte-xp-familier: progress, shared ranking, podium and targeted resource.
describe('petXpProgress', () => {
  it('gives the level and the share of the last level reached, rounded to 0.1', () => {
    expect(petXpProgress(0)).toEqual({ level: 0, totalXp: 0, percent: 0 });
    expect(petXpProgress(47003)).toEqual({ level: 85, totalXp: 47003, percent: 26.2 });
    expect(petXpProgress(179592)).toEqual({ level: 100, totalXp: 179592, percent: 100 });
  });
});

describe('ranking, podium and targeted resource', () => {
  // 100 000 XP. Plume: 25 000 units × 3 = 75 000. Poussière: 200 000 units (above a 50 000 cap) × 1.
  // Os: 50 000 × 5 = 250 000. Rune: 10 000 × 40 = 400 000. Écaille: no price.
  const foods = [food('a', 'Poussière', 0.5), food('b', 'Os', 2), food('c', 'Rune', 10), food('d', 'Plume', 4), food('e', 'Écaille', 20)];
  const prices = {
    a: { unitPriceKamas: 1, origin: 'carnet' as const },
    b: { unitPriceKamas: 5, origin: 'carnet' as const },
    c: { unitPriceKamas: 40, origin: 'carnet' as const },
    d: { unitPriceKamas: 3, origin: 'carnet' as const, date: '2026-10-01T00:00:00Z' },
  };
  const ranked = rankPetFoods(100_000, foods, prices, 50_000);

  it('ranks the priced foods under the cap by total cost, from 1', () => {
    expect(ranked.map((line) => [line.food.name, line.rank, line.totalKamas])).toEqual([['Plume', 1, 75_000], ['Os', 2, 250_000], ['Rune', 3, 400_000]]);
  });

  it('keeps the foods above the cap without one, and ranks with the Almanax', () => {
    expect(rankPetFoods(100_000, foods, prices, undefined).map((line) => line.food.name)).toEqual(['Plume', 'Poussière', 'Os', 'Rune']);
    expect(rankPetFoods(100_000, foods, prices, 50_000, ALMANAX_PET_XP_MULTIPLIER)[0].quantity).toBe(16_667);
  });

  it('ranks nothing when no XP is left to give', () => {
    expect(rankPetFoods(0, foods, prices, 50_000)).toEqual([]);
  });

  it('puts the first 3 on the podium with their gap to the cheapest', () => {
    expect(petFoodPodium(ranked).map((line) => [line.food.name, line.gapKamas])).toEqual([['Plume', 0], ['Os', 175_000], ['Rune', 325_000]]);
    expect(petFoodPodium(ranked.slice(0, 2))).toHaveLength(2);
    expect(petFoodPodium([])).toEqual([]);
  });

  it('gives the card of a ranked food, with its gap in % to the cheapest', () => {
    const card = petFoodTarget(foods[2], 100_000, prices, ranked, 50_000);
    expect(card).toMatchObject({ xpPerUnit: 10, quantity: 10_000, sharePercent: 0.01, price: { unitPriceKamas: 40, totalKamas: 400_000 } });
    expect(card.standing).toEqual({ kind: 'ranked', rank: 3, gapPercent: 433.3 });
    expect(petFoodTarget(foods[3], 100_000, prices, ranked, 50_000).standing).toEqual({ kind: 'ranked', rank: 1, gapPercent: 0 });
  });

  it('says when the food is above the cap or has no price', () => {
    expect(petFoodTarget(foods[0], 100_000, prices, ranked, 50_000)).toMatchObject({ quantity: 200_000, price: { totalKamas: 200_000 }, standing: { kind: 'capped', maxQuantity: 50_000 } });
    const unpriced = petFoodTarget(foods[4], 100_000, prices, ranked, 50_000);
    expect(unpriced).toMatchObject({ quantity: 5_000, sharePercent: 0.02, standing: { kind: 'unpriced' } });
    expect(unpriced.price).toBeUndefined();
  });

  it('applies the Almanax and never gives more than 100 % of the objective', () => {
    expect(petFoodTarget(foods[3], 100_000, prices, ranked, 50_000, ALMANAX_PET_XP_MULTIPLIER)).toMatchObject({ xpPerUnit: 6, quantity: 16_667 });
    expect(petFoodTarget(foods[2], 5, prices, ranked, 50_000).sharePercent).toBe(100);
  });

  it('writes the share of the objective with 2 significant digits', () => {
    expect(formatObjectiveShare(0.01874)).toBe('0,019');
    expect(formatObjectiveShare(26.2)).toBe('26');
    expect(formatObjectiveShare(100)).toBe('100');
  });
});
