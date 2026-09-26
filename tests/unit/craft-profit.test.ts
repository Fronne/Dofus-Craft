import { describe, expect, it } from 'vitest';
import { filterProfitRows, profitRow, sortProfitRows, type CraftProfitRow } from '../../src/domain/craft-profit';
import type { Comparison } from '../../src/domain/types';

// specs/019-craft-profit-list, data-model.md « Ligne de bénéfice », « Tri et filtre ».
const DATE = '2026-09-24T10:00:00.000Z';
const comparison = (knownCraftCostKamas: number, marketPriceKamas?: number, complete = true): Comparison => ({
  lines: [],
  knownCraftCostKamas,
  missingResourceIds: complete ? [] : ['r1'],
  craftCostStatus: complete ? 'complete' : 'partial',
  marketPriceKamas,
  recommendation: 'craft',
});
const row = (name: string, profitKamas: number, marginPercent?: number): CraftProfitRow =>
  ({ item: { id: name, name }, marketPriceKamas: 0, marketPriceDate: DATE, craftCostKamas: 0, profitKamas, marginPercent });

describe('profitRow (specs/019)', () => {
  it('computes the profit and the margin on the craft cost, rounded', () => {
    expect(profitRow({ id: '1', name: 'A' }, comparison(3000, 4000), DATE)).toEqual({
      item: { id: '1', name: 'A' }, marketPriceKamas: 4000, marketPriceDate: DATE, craftCostKamas: 3000, profitKamas: 1000, marginPercent: 33,
    });
    expect(profitRow({ id: '1', name: 'A' }, comparison(5000, 3000), DATE)).toMatchObject({ profitKamas: -2000, marginPercent: -40 });
  });

  it('gives no line for a partial craft cost or without an HDV price (FR-009)', () => {
    expect(profitRow({ id: '1', name: 'A' }, comparison(3000, 4000, false), DATE)).toBeUndefined();
    expect(profitRow({ id: '1', name: 'A' }, comparison(3000), DATE)).toBeUndefined();
  });

  it('leaves the margin out when the craft costs nothing', () => {
    expect(profitRow({ id: '1', name: 'A' }, comparison(0, 4000), DATE)?.marginPercent).toBeUndefined();
  });
});

describe('sortProfitRows / filterProfitRows (specs/019)', () => {
  const rows = [row('Bottes', 5000, 10), row('Anneau', 12000, 5), row('Coiffe', -2000, -20), row('Amulette', 5000, 50), row('Dague', 100)];

  it('sorts by profit in kamas, ties by name', () => {
    expect(sortProfitRows(rows, { key: 'kamas', direction: 'desc' }).map((entry) => entry.item.name)).toEqual(['Anneau', 'Amulette', 'Bottes', 'Dague', 'Coiffe']);
  });

  it('sorts by margin, a missing margin last', () => {
    expect(sortProfitRows(rows, { key: 'percent', direction: 'desc' }).map((entry) => entry.item.name)).toEqual(['Amulette', 'Bottes', 'Anneau', 'Coiffe', 'Dague']);
  });

  it('sorts ascending on a second click, a missing margin still last', () => {
    expect(sortProfitRows(rows, { key: 'percent', direction: 'asc' }).map((entry) => entry.item.name)).toEqual(['Coiffe', 'Anneau', 'Bottes', 'Amulette', 'Dague']);
    expect(sortProfitRows(rows, { key: 'name', direction: 'asc' }).map((entry) => entry.item.name)).toEqual(['Amulette', 'Anneau', 'Bottes', 'Coiffe', 'Dague']);
  });

  it('filters by name without accents or case', () => {
    expect(filterProfitRows([row('Amulette du Strigide', 1), row('Épée', 1)], 'AMUL').map((entry) => entry.item.name)).toEqual(['Amulette du Strigide']);
    expect(filterProfitRows([row('Épée', 1)], 'epee')).toHaveLength(1);
  });
});
