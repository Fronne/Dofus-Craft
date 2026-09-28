import { describe, expect, it } from 'vitest';
import { MissingHdvTypesError, selectHdvItems, type HdvCandidate, type HdvTypeMap } from '../../scripts/hdv-items-selection.mjs';

// specs/023-hdv-price-entry (contracts/hdv-type-map.md): which items the HDV tabs list.
const typeMap: HdvTypeMap = {
  source: 'test',
  checkedAt: '2026-09-28',
  types: { '15': 'resources', '12': 'consumables', '209': 'animals', '78': null },
  excludedTypes: [97],
  listAllExchangeable: [209],
};

const item = (id: string, typeId: number, overrides: Partial<HdvCandidate> = {}): HdvCandidate =>
  ({ id, name: `Objet ${id}`, typeId, exchangeable: true, ...overrides });

describe('selectHdvItems', () => {
  it('lists a useful exchangeable item in the HDV of its type', () => {
    const { items } = selectHdvItems({ typeMap, usefulIds: new Set(['1', '2']), candidates: [item('1', 15), item('2', 12)] });
    expect(items.map((entry) => [entry.id, entry.hdv])).toEqual([['1', 'resources'], ['2', 'consumables']]);
  });

  it('ignores an item that is neither useful nor of a type listed in full', () => {
    const { items } = selectHdvItems({ typeMap, usefulIds: new Set(), candidates: [item('1', 15)] });
    expect(items).toEqual([]);
  });

  it('lists every exchangeable pet food, even one the app does not use (FR-004b)', () => {
    const { items } = selectHdvItems({ typeMap, usefulIds: new Set(), candidates: [item('5', 209)] });
    expect(items).toEqual([expect.objectContaining({ id: '5', hdv: 'animals' })]);
  });

  it('never lists an excluded type (Dragodinde certificates), even as an ingredient', () => {
    const { items, skipped } = selectHdvItems({ typeMap, usefulIds: new Set(['9']), candidates: [item('9', 97)] });
    expect(items).toEqual([]);
    expect(skipped.excluded).toBe(1);
  });

  it('counts a type sold in an HDV out of scope without listing it', () => {
    const { items, skipped } = selectHdvItems({ typeMap, usefulIds: new Set(['3']), candidates: [item('3', 78)] });
    expect(items).toEqual([]);
    expect(skipped.outOfScope).toBe(1);
  });

  it('never lists an item that is not exchangeable', () => {
    const { items, skipped } = selectHdvItems({ typeMap, usefulIds: new Set(['4']), candidates: [item('4', 15, { exchangeable: false })] });
    expect(items).toEqual([]);
    expect(skipped.notExchangeable).toBe(1);
  });

  it('keeps an item found twice only once', () => {
    const { items } = selectHdvItems({ typeMap, usefulIds: new Set(['5']), candidates: [item('5', 209), item('5', 209)] });
    expect(items).toHaveLength(1);
  });

  it('fails and names the types missing from the map instead of guessing them', () => {
    const run = () => selectHdvItems({ typeMap, usefulIds: new Set(['6', '7']), candidates: [item('6', 300), item('7', 42)] });
    expect(run).toThrow(MissingHdvTypesError);
    expect(run).toThrow(/42, 300/);
  });

  it('sorts by HDV, then by name in French order', () => {
    const { items } = selectHdvItems({
      typeMap,
      usefulIds: new Set(['1', '2', '3']),
      candidates: [item('1', 12, { name: 'Bière' }), item('2', 15, { name: 'Écorce' }), item('3', 15, { name: 'Ail' })],
    });
    expect(items.map((entry) => entry.name)).toEqual(['Ail', 'Écorce', 'Bière']);
  });
});
