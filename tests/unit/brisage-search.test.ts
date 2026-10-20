import { describe, expect, it } from 'vitest';
import runeItems from '../../src/data/rune-items.json';
import type { RuneItemsData } from '../../src/domain/forgemagie';
import { analyzeBrisage, defaultBrisageSettings, runeForStat, wholeRunes } from '../../src/domain/brisage';
import {
  browseItems,
  estimateTargetRunes,
  HUNT_EFFECT_IDS,
  levelRangeError,
  searchItemsByStats,
  searchResults,
  sortSearchResults,
  statGroup,
  targetableStats,
  type IndexedItem,
} from '../../src/domain/brisage-search';

// specs/064-recherche-objets-par-stats: which items give the runes of chosen stats.
const RUNES = (runeItems as RuneItemsData).runes;
const SETTINGS = defaultBrisageSettings();
const VI = 125, SA = 124, PROSPE = 176, FO = 118;
const runeId = (effectId: number) => runeForStat(RUNES, effectId, 'ba')!.rune.id;

const item = (id: string, name: string, level: number, effects: IndexedItem['effects']): IndexedItem => ({ id, name, level, effects });
const range = (effectId: number, from: number, to = from) => ({ effectId, from, to });

describe('targetableStats', () => {
  it('keeps the stats with a rune and never the hunt stat', () => {
    const ids = targetableStats(RUNES).map((stat) => stat.effectId);
    expect(ids).toContain(PROSPE);
    for (const hunt of HUNT_EFFECT_IDS) expect(ids).not.toContain(hunt);
  });

  it('drops a stat that has no rune', () => {
    const withoutVitality = RUNES.filter((rune) => rune.effectId !== VI);
    expect(targetableStats(withoutVitality).map((stat) => stat.effectId)).not.toContain(VI);
  });
});

describe('searchItemsByStats', () => {
  const items = [
    item('1', 'Anneau A', 100, [range(VI, 100, 150), range(SA, 20, 30)]),
    item('2', 'Anneau B', 120, [range(VI, 200)]),
    item('3', 'Anneau C', 80, [range(SA, 10)]),
    item('4', 'Anneau D', 60, [range(FO, -5, -1), range(VI, 10, 20)]),
  ];

  it('lists no item while no stat is chosen', () => {
    expect(searchItemsByStats(items, [])).toEqual([]);
  });

  it('keeps the items with a positive roll on the chosen stat', () => {
    expect(searchItemsByStats(items, [VI]).map((i) => i.id)).toEqual(['1', '2', '4']);
  });

  it('requires EVERY chosen stat', () => {
    expect(searchItemsByStats(items, [VI, SA]).map((i) => i.id)).toEqual(['1']);
  });

  it('does not list an item whose only roll on the stat is negative', () => {
    expect(searchItemsByStats(items, [FO])).toEqual([]);
  });

  it('ignores the hunt stat', () => {
    expect(searchItemsByStats(items, HUNT_EFFECT_IDS)).toEqual([]);
  });

  it('applies the level range, bounds included', () => {
    expect(searchItemsByStats(items, [VI], { minLevel: 100, maxLevel: 100 }).map((i) => i.id)).toEqual(['1']);
    expect(searchItemsByStats(items, [VI], { minLevel: 101 }).map((i) => i.id)).toEqual(['2']);
  });

  it('refuses an inverted level range', () => {
    expect(levelRangeError({ minLevel: 200, maxLevel: 100 })).toBeTruthy();
    expect(levelRangeError({ minLevel: 100, maxLevel: 100 })).toBeUndefined();
    expect(searchItemsByStats(items, [VI], { minLevel: 200, maxLevel: 100 })).toEqual([]);
  });
});

describe('estimateTargetRunes', () => {
  it('matches the normal breaking of analyzeBrisage at a coefficient of 100 %', () => {
    const source = item('1', 'Anneau', 150, [range(VI, 100, 140), range(SA, 20, 30)]);
    const estimate = estimateTargetRunes(source, [VI, SA], RUNES, SETTINGS)!;
    const analysis = analyzeBrisage(
      { level: 150, lines: [{ effectId: VI, value: 120 }, { effectId: SA, value: 25 }], coefficient: 100, itemCostKamas: 0 },
      RUNES, {}, SETTINGS,
    );
    if (analysis.status !== 'ok') throw new Error(analysis.reason);
    const normal = analysis.options.find((option) => option.kind === 'normal')!;
    for (const stat of estimate.perStat) {
      expect(stat.runes).toBe(wholeRunes(normal.yields.find((y) => y.effectId === stat.effectId)!.count));
    }
    expect(estimate.totalRunes).toBe(estimate.perStat[0].runes + estimate.perStat[1].runes);
  });

  it('values the runes only when every targeted rune has a price', () => {
    const source = item('1', 'Anneau', 150, [range(VI, 120), range(SA, 25)]);
    const full = estimateTargetRunes(source, [VI, SA], RUNES, SETTINGS, { [runeId(VI)]: 2, [runeId(SA)]: 10 })!;
    expect(full.valueKamas).toBe(full.perStat[0].runes * 2 + full.perStat[1].runes * 10);
    const missing = estimateTargetRunes(source, [VI, SA], RUNES, SETTINGS, { [runeId(VI)]: 2 })!;
    expect(missing.valueKamas).toBeUndefined();
    const zero = estimateTargetRunes(source, [VI], RUNES, SETTINGS, { [runeId(VI)]: 0 })!;
    expect(zero.valueKamas).toBeUndefined();
  });

  it('gives nothing for a stat the item does not have', () => {
    expect(estimateTargetRunes(item('1', 'Anneau', 100, [range(VI, 50)]), [SA], RUNES, SETTINGS)).toBeUndefined();
  });
});

describe('sortSearchResults', () => {
  const prices = { [runeId(VI)]: 3 };
  const make = (id: string, name: string, level: number, roll: number) =>
    estimateTargetRunes(item(id, name, level, [range(VI, roll)]), [VI], RUNES, SETTINGS, prices)!;

  it('puts the items giving the most targeted runes first (SC-004: six items, known order)', () => {
    // Same level, so the runes follow the roll: 300 > 250 > 200 > 150 > 100 > 50.
    const rolls = [150, 50, 300, 200, 100, 250];
    const results = rolls.map((roll, index) => make(String(index), `Objet ${index}`, 150, roll));
    const sorted = sortSearchResults(results, 'runes');
    expect(sorted.map((r) => r.item.id)).toEqual(['2', '5', '3', '0', '4', '1']);
    expect(sorted.slice(0, 5).map((r) => r.item.id)).toEqual(['2', '5', '3', '0', '4']);
  });

  it('is stable: equal values keep a name then id order', () => {
    const results = [make('2', 'B', 100, 100), make('1', 'B', 100, 100), make('3', 'A', 100, 100)];
    expect(sortSearchResults(results, 'runes').map((r) => r.item.id)).toEqual(['3', '1', '2']);
  });

  it('sorts by value and puts an unknown value last, never as 0', () => {
    const priced = make('1', 'Cher', 100, 100);
    const unknown = estimateTargetRunes(item('2', 'Sans prix', 100, [range(SA, 500)]), [SA], RUNES, SETTINGS, prices)!;
    expect(unknown.valueKamas).toBeUndefined();
    expect(sortSearchResults([unknown, priced], 'kamas').map((r) => r.item.id)).toEqual(['1', '2']);
  });

  it('sorts by the highest roll', () => {
    const results = [make('1', 'A', 200, 100), make('2', 'B', 50, 400)];
    expect(sortSearchResults(results, 'maxRoll').map((r) => r.item.id)).toEqual(['2', '1']);
  });
});

describe('searchResults', () => {
  it('searches, estimates and sorts', () => {
    const items = [item('1', 'Faible', 50, [range(FO, 10)]), item('2', 'Fort', 200, [range(FO, 60)]), item('3', 'Autre', 200, [range(VI, 60)])];
    const results = searchResults(items, [FO], {}, RUNES, SETTINGS, {}, 'runes');
    expect(results.map((r) => r.item.id)).toEqual(['2', '1']);
  });
});

// specs/065-refonte-page-brisage: one list for the name, the category, the level and the stats.
describe('statGroup', () => {
  it('puts every targetable stat in exactly one group', () => {
    for (const stat of targetableStats(RUNES)) {
      expect(['caracteristiques', 'degats', 'resistances']).toContain(statGroup(stat.effectId));
    }
  });

  it('files tackle, dodge, lock and withdrawal under the characteristics', () => {
    for (const effectId of [753, 752, 160, 161, 410, 412]) expect(statGroup(effectId)).toBe('caracteristiques');
  });

  it('files the damages and the resistances apart', () => {
    expect(statGroup(112)).toBe('degats');
    expect(statGroup(422)).toBe('degats');
    expect(statGroup(240)).toBe('resistances');
    expect(statGroup(210)).toBe('resistances');
    expect(statGroup(VI)).toBe('caracteristiques');
  });
});

describe('browseItems', () => {
  const withCategory = (source: IndexedItem, categoryId: string): IndexedItem => ({ ...source, categoryId });
  const items = [
    withCategory(item('1', 'Cape Étoilée', 150, [range(VI, 100, 150), range(SA, 20, 30)]), 'equipment-type-10'),
    withCategory(item('2', 'Anneau du Corbeau', 120, [range(VI, 200)]), 'equipment-type-3'),
    withCategory(item('3', 'Cape Sombre', 80, [range(SA, 10)]), 'equipment-type-10'),
    item('4', 'Sans catégorie', 60, [range(VI, 10, 20)]),
  ];
  const base = { query: '', effectIds: [] as number[], sort: 'runes' as const };
  const ids = (results: ReturnType<typeof browseItems>) => results.map((r) => r.item.id);
  const browse = (change: Partial<typeof base> & { categoryId?: string; minLevel?: number; maxLevel?: number }) =>
    browseItems(items, { ...base, ...change }, RUNES, SETTINGS, {});

  it('lists every item, highest level first then by name, while nothing is chosen', () => {
    const results = browse({});
    expect(ids(results)).toEqual(['1', '2', '3', '4']);
    expect(results[0].perStat).toEqual([]);
    expect(results[0].valueKamas).toBeUndefined();
  });

  it('matches the name without accents or case, every word', () => {
    expect(ids(browse({ query: 'cape' }))).toEqual(['1', '3']);
    expect(ids(browse({ query: 'ETOILEE cape' }))).toEqual(['1']);
    expect(ids(browse({ query: 'corbeau anneau' }))).toEqual(['2']);
    expect(ids(browse({ query: 'zzz' }))).toEqual([]);
  });

  it('ignores a name shorter than two letters', () => {
    expect(ids(browse({ query: 'c' }))).toEqual(['1', '2', '3', '4']);
    expect(ids(browse({ query: '  ' }))).toEqual(['1', '2', '3', '4']);
  });

  it('filters by category and never lists an item without category under one', () => {
    expect(ids(browse({ categoryId: 'equipment-type-10' }))).toEqual(['1', '3']);
    expect(ids(browse({ categoryId: 'equipment-type-99' }))).toEqual([]);
  });

  it('filters by level, bounds included, and refuses an inverted range', () => {
    expect(ids(browse({ minLevel: 120, maxLevel: 150 }))).toEqual(['1', '2']);
    expect(ids(browse({ minLevel: 200, maxLevel: 100 }))).toEqual([]);
  });

  it('requires every chosen stat and sorts like searchResults', () => {
    expect(ids(browse({ effectIds: [VI, SA] }))).toEqual(['1']);
    expect(browse({ effectIds: [VI] })).toEqual(searchResults(items, [VI], {}, RUNES, SETTINGS, {}, 'runes'));
    expect(browse({ effectIds: [VI] })[0].perStat.length).toBe(1);
  });

  it('combines the name, the category, the level and the stats', () => {
    expect(ids(browse({ query: 'cape', categoryId: 'equipment-type-10', minLevel: 100, effectIds: [SA] }))).toEqual(['1']);
  });

  it('does not change what it is given', () => {
    const copy = JSON.parse(JSON.stringify(items));
    browse({ query: 'cape', effectIds: [VI] });
    expect(items).toEqual(copy);
  });
});
