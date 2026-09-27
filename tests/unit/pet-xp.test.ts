import { describe, expect, it } from 'vitest';
import { planPetFood, quantityFor, validatePetLevels, xpNeeded, type PetFood } from '../../src/domain/pet-xp';

const food = (itemId: string, name: string, xpPerUnit: number): PetFood =>
  ({ itemId, name, xpPerUnit, sourceName: name });

describe('xpNeeded', () => {
  it('computes the XP between two levels from the reference curve', () => {
    expect(xpNeeded({ currentLevel: 0, xpInLevel: 0, targetLevel: 100 })).toBe(179592);
    expect(xpNeeded({ currentLevel: 50, xpInLevel: 0, targetLevel: 60 })).toBe(2859);
  });

  it('subtracts the XP already gained in the current level', () => {
    expect(xpNeeded({ currentLevel: 50, xpInLevel: 150, targetLevel: 60 })).toBe(2709);
  });

  it('needs no XP when the target is not above the current level', () => {
    expect(xpNeeded({ currentLevel: 60, xpInLevel: 0, targetLevel: 60 })).toBe(0);
    expect(xpNeeded({ currentLevel: 60, xpInLevel: 0, targetLevel: 40 })).toBe(0);
  });
});

describe('validatePetLevels', () => {
  it('accepts valid levels', () => {
    expect(validatePetLevels({ currentLevel: 50, xpInLevel: 0, targetLevel: 60 })).toEqual({});
  });

  it('rejects levels outside the range or not integers', () => {
    expect(validatePetLevels({ currentLevel: 0, xpInLevel: 0, targetLevel: 60 })).toEqual({});
    expect(validatePetLevels({ currentLevel: -1, xpInLevel: 0, targetLevel: 60 }).currentLevel).toBeDefined();
    expect(validatePetLevels({ currentLevel: 5, xpInLevel: 0, targetLevel: 0 }).targetLevel).toBeDefined();
    expect(validatePetLevels({ currentLevel: 100, xpInLevel: 0, targetLevel: 100 }).currentLevel).toBeDefined();
    expect(validatePetLevels({ currentLevel: 5.5, xpInLevel: 0, targetLevel: 60 }).currentLevel).toBeDefined();
    expect(validatePetLevels({ currentLevel: 5, xpInLevel: 0, targetLevel: 101 }).targetLevel).toBeDefined();
  });

  it('caps the XP already gained at what the level can hold', () => {
    // Level 50 → 51 takes 1 883 − 1 703 = 180 XP, so at most 179 inside level 50.
    expect(validatePetLevels({ currentLevel: 50, xpInLevel: 179, targetLevel: 60 })).toEqual({});
    expect(validatePetLevels({ currentLevel: 50, xpInLevel: 180, targetLevel: 60 }).xpInLevel).toContain('179');
    expect(validatePetLevels({ currentLevel: 50, xpInLevel: -1, targetLevel: 60 }).xpInLevel).toBeDefined();
  });
});

describe('planPetFood', () => {
  it('computes quantity and total cost for the XP needed', () => {
    const plan = planPetFood(1000, [food('1', 'Rune', 0.25)], { 1: { unitPriceKamas: 10, origin: 'carnet' } });
    expect(plan.recommendations[0]).toMatchObject({ quantity: 4000, totalKamas: 40000 });
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
