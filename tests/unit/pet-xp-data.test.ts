import { describe, expect, it } from 'vitest';
import data from '../../src/data/pet-xp-data.json';

// specs/022-pet-xp-calculator, contracts/pet-xp-data.md: invariants of the frozen data file.
describe('pet-xp-data.json', () => {
  it('has 100 strictly increasing cumulative XP levels, 1 at level 1 and 196 159 at level 100', () => {
    const curve = data.cumulativeXpByLevel;
    expect(curve).toHaveLength(100);
    expect(curve[0]).toBe(1);
    expect(curve[99]).toBe(196159);
    curve.slice(1).forEach((value, index) => expect(value).toBeGreaterThan(curve[index]));
  });

  it('lists each food once with a positive XP and a positive integer quantity', () => {
    const ids = data.foods.map((food) => food.itemId);
    expect(new Set(ids).size).toBe(ids.length);
    data.foods.forEach((food) => {
      expect(food.xpGiven).toBeGreaterThan(0);
      expect(Number.isInteger(food.quantityNeeded) && food.quantityNeeded > 0).toBe(true);
    });
  });

  it('records its source', () => {
    expect(data.source).toBeTruthy();
    expect(data.sourceUrl).toMatch(/^https:\/\//);
    expect(data.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
