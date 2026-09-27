import { describe, expect, it } from 'vitest';
import data from '../../src/data/pet-xp-data.json';

// specs/022-pet-xp-calculator, contracts/pet-xp-data.md: invariants of the frozen data file.
describe('pet-xp-data.json', () => {
  it('has 101 strictly increasing cumulative XP levels, 0 at level 0 and 179 592 at level 100', () => {
    const curve = data.cumulativeXpByLevel;
    expect(curve).toHaveLength(101);
    expect(curve[0]).toBe(0);
    expect(curve[100]).toBe(179592);
    curve.slice(1).forEach((value, index) => expect(value).toBeGreaterThan(curve[index]));
  });

  it('lists each food once with a positive XP per unit', () => {
    const ids = data.foods.map((food) => food.itemId);
    expect(new Set(ids).size).toBe(ids.length);
    data.foods.forEach((food) => {
      expect(food.xpPerUnit).toBeGreaterThan(0);
    });
  });

  it('records its source', () => {
    expect(data.source).toBeTruthy();
    expect(data.sourceUrl).toMatch(/^https:\/\//);
    expect(data.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
