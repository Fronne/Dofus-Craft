import { describe, expect, it } from 'vitest';
import { planPetFood, quantityFor, validatePetLevels, xpNeeded, type PetFood } from '../../src/domain/pet-xp';

const food = (itemId: string, name: string, xpGiven: number, quantityNeeded: number): PetFood =>
  ({ itemId, name, xpGiven, quantityNeeded, sourceName: name });

describe('xpNeeded', () => {
  it('computes the XP between two levels from the reference curve', () => {
    expect(xpNeeded({ currentLevel: 1, xpInLevel: 0, targetLevel: 100 })).toBe(196158);
    expect(xpNeeded({ currentLevel: 50, xpInLevel: 0, targetLevel: 60 })).toBe(3141);
  });

  it('subtracts the XP already gained in the current level', () => {
    expect(xpNeeded({ currentLevel: 50, xpInLevel: 150, targetLevel: 60 })).toBe(2991);
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
    expect(validatePetLevels({ currentLevel: 0, xpInLevel: 0, targetLevel: 60 }).currentLevel).toBeDefined();
    expect(validatePetLevels({ currentLevel: 100, xpInLevel: 0, targetLevel: 100 }).currentLevel).toBeDefined();
    expect(validatePetLevels({ currentLevel: 5.5, xpInLevel: 0, targetLevel: 60 }).currentLevel).toBeDefined();
    expect(validatePetLevels({ currentLevel: 5, xpInLevel: 0, targetLevel: 101 }).targetLevel).toBeDefined();
  });

  it('caps the XP already gained at what the level can hold', () => {
    // Level 50 → 51 takes 2 080 − 1 882 = 198 XP, so at most 197 inside level 50.
    expect(validatePetLevels({ currentLevel: 50, xpInLevel: 197, targetLevel: 60 })).toEqual({});
    expect(validatePetLevels({ currentLevel: 50, xpInLevel: 198, targetLevel: 60 }).xpInLevel).toContain('197');
    expect(validatePetLevels({ currentLevel: 50, xpInLevel: -1, targetLevel: 60 }).xpInLevel).toBeDefined();
  });
});

describe('planPetFood', () => {
  it('computes quantity and total cost for the XP needed', () => {
    const plan = planPetFood(1000, [food('1', 'Rune', 1, 4)], { 1: { unitPriceKamas: 10, origin: 'carnet' } });
    expect(plan.recommendations[0]).toMatchObject({ quantity: 4000, totalKamas: 40000 });
  });

  it('rounds the quantity up, without floating-point noise', () => {
    const pepite = food('1', 'Pépite', 1.25, 1);
    expect(quantityFor(1000, pepite)).toBe(800);
    expect(quantityFor(1001, pepite)).toBe(801);
    expect(quantityFor(3, food('2', 'Eau', 0.1, 1))).toBe(30);
  });

  it('sorts by total cost then name, keeps at most 10 lines and counts unpriced foods', () => {
    const foods = Array.from({ length: 12 }, (_, index) => food(String(index), `R${String(index).padStart(2, '0')}`, 1, 1));
    const prices = Object.fromEntries(foods.slice(0, 11).map((entry, index) => [entry.itemId, { unitPriceKamas: 20 - index, origin: 'carnet' as const }]));
    prices['0'] = { unitPriceKamas: 10, origin: 'carnet' };
    const plan = planPetFood(10, foods, prices);
    expect(plan.recommendations).toHaveLength(10);
    expect(plan.recommendations.map((line) => line.food.name).slice(0, 2)).toEqual(['R00', 'R10']);
    expect(plan.unpricedCount).toBe(1);
  });

  it('recommends nothing when no XP is needed', () => {
    expect(planPetFood(0, [food('1', 'Rune', 1, 1)], { 1: { unitPriceKamas: 5, origin: 'carnet' } }).recommendations).toEqual([]);
  });
});
