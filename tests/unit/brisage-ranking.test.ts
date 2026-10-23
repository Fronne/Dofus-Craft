import { describe, expect, it } from 'vitest';
import runeItems from '../../src/data/rune-items.json';
import { analyzeBrisage, analyzeFocusAdvice, averageRoll, defaultBrisageSettings } from '../../src/domain/brisage';
import type { IndexedItem } from '../../src/domain/brisage-search';
import {
  ageInDays, bestExoFor, buildRanking, buildRankingRow, DEFAULT_RANKING_VIEW, filterRows, freshnessOf, sortRows,
  STALE_AFTER_DAYS, type RankingContext, type RankingRow,
} from '../../src/domain/brisage-ranking';
import type { RuneItemsData } from '../../src/domain/forgemagie';

// specs/072-classement-brisage. Real rune data: Rune Vi 1523 (effect 125), Rune Cha 1525 (123), Rune Do 7435 (112),
// Rune Ga Pa 1557 (effect 111).
const RUNES = (runeItems as RuneItemsData).runes;
const SETTINGS = defaultBrisageSettings();
const NOW = new Date('2026-10-23T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString();

const cape: IndexedItem = { id: '777', name: 'Cape du Chef Bwork', level: 100, categoryId: 'cat-cape', effects: [{ effectId: 125, from: 40, to: 44 }, { effectId: 123, from: 38, to: 38 }] };
const ring: IndexedItem = { id: '888', name: 'Anneau du Sage', level: 60, categoryId: 'cat-ring', effects: [{ effectId: 112, from: 1, to: 9 }] };
const empty: IndexedItem = { id: '999', name: 'Objet inconnu', level: 10, effects: [{ effectId: 999999, from: 2, to: 2 }] };

const context = (overrides: Partial<RankingContext> = {}): RankingContext => ({
  runes: RUNES,
  settings: SETTINGS,
  runePrices: { '1523': 5, '1525': 5, '7435': 3000 },
  runePriceDates: { '1523': ago(1), '1525': ago(3), '7435': ago(0.5), '1557': ago(2) },
  itemPrices: new Map([['777', { kamas: 800, updatedAt: ago(2) }], ['888', { kamas: 5000, updatedAt: ago(9) }], ['999', { kamas: 100 }]]),
  coefficients: new Map([['777', { coefficient: 38, savedAt: ago(1) }]]),
  ...overrides,
});

describe('freshnessOf', () => {
  it('tells fresh, old, stale and unknown', () => {
    expect(freshnessOf(ago(0.2), NOW)).toBe('fresh');
    expect(freshnessOf(ago(3), NOW)).toBe('old');
    expect(freshnessOf(ago(STALE_AFTER_DAYS), NOW)).toBe('stale');
    expect(freshnessOf(ago(30), NOW)).toBe('stale');
    expect(freshnessOf(undefined, NOW)).toBe('unknown');
    expect(freshnessOf('not a date', NOW)).toBe('unknown');
  });

  it('gives the age in whole days', () => {
    expect(ageInDays(ago(3.4), NOW)).toBe(3);
    expect(ageInDays(ago(0), NOW)).toBe(0);
    expect(ageInDays(undefined, NOW)).toBeUndefined();
  });
});

describe('buildRankingRow with a known coefficient', () => {
  it('gives the same gain, best choice and threshold as the item page (SC-002)', () => {
    const row = buildRankingRow(cape, context());
    const direct = analyzeBrisage(
      { level: 100, lines: [{ effectId: 125, value: averageRoll(40, 44) }, { effectId: 123, value: 38 }], coefficient: 38, itemCostKamas: 800 },
      RUNES, context().runePrices, SETTINGS,
    );
    expect(direct.status).toBe('ok');
    if (direct.status !== 'ok') return;
    expect(row.group).toBe('known');
    expect(row.status).toBe('ok');
    expect(row.gainKamas).toBe(direct.best!.gainKamas);
    expect(row.best?.kind).toBe(direct.best!.kind);
    expect(row.thresholdCoefficient).toBe(direct.best!.kind === 'focus' ? direct.focusThresholdCoefficient : direct.thresholdCoefficient);
    expect(row.unreachable).toBe(false);
  });

  it('keeps a loss as a negative gain', () => {
    const row = buildRankingRow(cape, context({ itemPrices: new Map([['777', { kamas: 5_000_000 }]]) }));
    expect(row.status).toBe('ok');
    expect(row.gainKamas!).toBeLessThan(0);
  });

  it('has no row figures for an item without a breakable line', () => {
    const row = buildRankingRow(empty, context({ coefficients: new Map([['999', { coefficient: 50, savedAt: ago(1) }]]) }));
    expect(row.status).toBe('no-breakable-line');
    expect(row.gainKamas).toBeUndefined();
  });

  it('never makes up a gain while no rune has a price', () => {
    const row = buildRankingRow(cape, context({ runePrices: {} }));
    expect(row.status).toBe('missing-rune-price');
    expect(row.gainKamas).toBeUndefined();
  });

  it('still ranks on the choice whose runes are all priced, like the item page', () => {
    // Only Rune Vi is priced: a focus on Vi is complete, breaking normally is not.
    const row = buildRankingRow(cape, context({ runePrices: { '1523': 5 } }));
    expect(row.status).toBe('ok');
    expect(row.best?.kind).toBe('focus');
  });

  it('has no gain for an item without a price', () => {
    const row = buildRankingRow(cape, context({ itemPrices: new Map() }));
    expect(row.status).toBe('no-price');
    expect(row.gainKamas).toBeUndefined();
  });

  it('keeps the date of the oldest rune the best choice gives (US3)', () => {
    const row = buildRankingRow(cape, context());
    expect(row.oldestRunePriceAt).toBeDefined();
    expect(Date.parse(row.oldestRunePriceAt!)).toBeLessThanOrEqual(Date.parse(ago(1)));
    expect(buildRankingRow(cape, context({ runePriceDates: {} })).oldestRunePriceAt).toBeUndefined();
  });
});

describe('buildRankingRow without a coefficient (US7)', () => {
  const unknown = (item: IndexedItem, price: number, prices = context().runePrices) =>
    buildRankingRow(item, context({ coefficients: new Map(), itemPrices: new Map([[item.id, { kamas: price }]]), runePrices: prices }));

  it('gives a threshold and no gain in kamas', () => {
    const row = unknown(cape, 800);
    const advice = analyzeFocusAdvice({ level: 100, lines: [{ effectId: 125, value: averageRoll(40, 44) }, { effectId: 123, value: 38 }], itemCostKamas: 800 }, RUNES, context().runePrices, SETTINGS);
    expect(advice.status).toBe('ok');
    if (advice.status !== 'ok') return;
    expect(row.group).toBe('unknown');
    expect(row.status).toBe('ok');
    expect(row.gainKamas).toBeUndefined();
    expect(row.thresholdCoefficient).toBeCloseTo(Math.min(advice.normalBreakEven ?? Infinity, advice.focusBreakEven ?? Infinity), 6);
  });

  it('keeps a threshold above 100 % (coefficients go up to 4000 %)', () => {
    const row = unknown(cape, 10_000);
    expect(row.thresholdCoefficient!).toBeGreaterThan(100);
    expect(row.thresholdCoefficient!).toBeLessThanOrEqual(4000);
    expect(row.unreachable).toBe(false);
  });

  it('marks a threshold above 4000 % as unreachable: no such coefficient exists', () => {
    const row = unknown(cape, 5_000_000);
    expect(row.thresholdCoefficient!).toBeGreaterThan(4000);
    expect(row.unreachable).toBe(true);
  });

  it('starts with the levels 1 to 200', () => {
    expect(DEFAULT_RANKING_VIEW.minLevel).toBe(1);
    expect(DEFAULT_RANKING_VIEW.maxLevel).toBe(200);
  });

  it('puts a lower threshold on the cheaper item', () => {
    const cheap = unknown(cape, 400);
    const dear = unknown(cape, 800);
    expect(cheap.thresholdCoefficient!).toBeLessThan(dear.thresholdCoefficient!);
  });

  it('does not make up a threshold while a rune has no price', () => {
    const row = unknown(cape, 800, { '1523': 5 });
    expect(row.status).toBe('missing-rune-price');
    expect(row.thresholdCoefficient).toBeUndefined();
  });
});

describe('sortRows (US2)', () => {
  const rows = (): RankingRow[] => buildRanking([cape, ring, empty], context({ coefficients: new Map([['777', { coefficient: 38, savedAt: ago(1) }], ['888', { coefficient: 60, savedAt: ago(1) }]]) }));

  it('sorts by level in both directions', () => {
    expect(sortRows(rows(), 'level', 'asc').map((r) => r.itemId)).toEqual(['888', '777', '999']);
    expect(sortRows(rows(), 'level', 'desc').map((r) => r.itemId)).toEqual(['777', '888', '999']);
  });

  it('sorts by name', () => {
    expect(sortRows(rows(), 'name', 'asc').map((r) => r.itemId)).toEqual(['888', '777', '999']);
  });

  it('puts a row without figures last, whatever the direction', () => {
    expect(sortRows(rows(), 'level', 'asc').at(-1)?.itemId).toBe('999');
    expect(sortRows(rows(), 'level', 'desc').at(-1)?.itemId).toBe('999');
    expect(sortRows(rows(), 'gain', 'asc').at(-1)?.itemId).toBe('999');
  });

  it('puts the rows missing a price last', () => {
    const list = buildRanking([cape, ring], context({ runePrices: { '1523': 5, '1525': 5 }, coefficients: new Map([['777', { coefficient: 38, savedAt: ago(1) }], ['888', { coefficient: 60, savedAt: ago(1) }]]) }));
    expect(list.find((r) => r.itemId === '888')?.status).toBe('missing-rune-price');
    expect(sortRows(list, 'gain', 'desc').at(-1)?.itemId).toBe('888');
    expect(sortRows(list, 'gain', 'asc').at(-1)?.itemId).toBe('888');
  });

  it('sorts a known group by gain, highest first by default', () => {
    const list = sortRows(rows().filter((r) => r.group === 'known' && r.status === 'ok'), 'gain', 'desc');
    for (let i = 1; i < list.length; i += 1) expect(list[i - 1].gainKamas!).toBeGreaterThanOrEqual(list[i].gainKamas!);
  });

  it('sorts the unknown group by threshold, lowest first when sorting by gain desc', () => {
    const list = buildRanking([cape, ring], context({ coefficients: new Map(), itemPrices: new Map([['777', { kamas: 800 }], ['888', { kamas: 100 }]]) }));
    const sorted = sortRows(list, 'gain', 'desc').filter((r) => r.status === 'ok');
    for (let i = 1; i < sorted.length; i += 1) expect(sorted[i - 1].thresholdCoefficient!).toBeLessThanOrEqual(sorted[i].thresholdCoefficient!);
  });

  it('keeps the order of two equal rows', () => {
    const twin = { ...rows()[0], itemId: 'twin', name: 'Jumeau' };
    const list = [rows()[0], twin];
    expect(sortRows(list, 'level', 'asc').map((r) => r.itemId)).toEqual([list[0].itemId, 'twin']);
    expect(sortRows(list, 'level', 'desc').map((r) => r.itemId)).toEqual([list[0].itemId, 'twin']);
  });
});

describe('filterRows (US4)', () => {
  const rows = () => buildRanking([cape, ring, empty], context({
    coefficients: new Map([['777', { coefficient: 38, savedAt: ago(1) }]]),
    itemPrices: new Map([['777', { kamas: 800 }], ['888', { kamas: 5000 }]]),
  }));
  const ids = (list: RankingRow[]) => list.map((r) => r.itemId).sort();

  it('hides the items without a price by default and shows them when asked', () => {
    expect(ids(filterRows(rows(), DEFAULT_RANKING_VIEW))).toEqual(['777', '888']);
    expect(ids(filterRows(rows(), { ...DEFAULT_RANKING_VIEW, hideWithoutPrice: false }))).toEqual(['777', '888', '999']);
  });

  it('hides the items without a coefficient', () => {
    expect(ids(filterRows(rows(), { ...DEFAULT_RANKING_VIEW, hideWithoutCoefficient: true }))).toEqual(['777']);
  });

  it('filters by level', () => {
    expect(ids(filterRows(rows(), { ...DEFAULT_RANKING_VIEW, minLevel: 80 }))).toEqual(['777']);
    expect(ids(filterRows(rows(), { ...DEFAULT_RANKING_VIEW, maxLevel: 80 }))).toEqual(['888']);
  });

  it('does not filter on a level range whose minimum is above its maximum', () => {
    expect(ids(filterRows(rows(), { ...DEFAULT_RANKING_VIEW, minLevel: 90, maxLevel: 70 }))).toEqual(['777', '888']);
  });

  it('filters by category and leaves out an item without a category', () => {
    expect(ids(filterRows(rows(), { ...DEFAULT_RANKING_VIEW, hideWithoutPrice: false, categoryId: 'cat-cape' }))).toEqual(['777']);
  });

  it('filters by minimum gain on the known coefficients only', () => {
    const known = rows().find((r) => r.itemId === '777')!;
    expect(ids(filterRows(rows(), { ...DEFAULT_RANKING_VIEW, minGainKamas: known.gainKamas! + 1 }))).toEqual(['888']);
    expect(ids(filterRows(rows(), { ...DEFAULT_RANKING_VIEW, minGainKamas: known.gainKamas! }))).toEqual(['777', '888']);
  });
});

describe('bestExoFor (US8)', () => {
  // Rune Ga Pa (1557, stat PA 111): an exo of 1 PA gives about 1.5 runes at 100 %, so it pays more than the rune only
  // at a high coefficient — at 38 % it gives under one rune and never pays.
  const highCoefficient = new Map([['777', { coefficient: 100, savedAt: ago(1) }]]);
  const withGaPa = (extra: Partial<RankingContext> = {}) => context({
    coefficients: highCoefficient,
    runePrices: { ...context().runePrices, '1557': 5000 },
    ...extra,
  });

  it('takes the price of one rune off the gain and keeps the exo only if it beats the item as it is', () => {
    const ctx = withGaPa();
    const row = buildRankingRow(cape, ctx);
    const exo = bestExoFor(cape, row, ctx);
    expect(exo).toBeDefined();
    expect(exo!.effectId).toBe(111);
    expect(exo!.runePriceKamas).toBe(5000);
    expect(exo!.gainKamas!).toBeGreaterThan(row.gainKamas!);
    expect(exo!.improvementKamas).toBeCloseTo(exo!.gainKamas! - row.gainKamas!, 6);
    expect(cape.effects.map((e) => e.effectId)).not.toContain(exo!.effectId);
  });

  it('recommends nothing when the exo gives less than the rune it costs (low coefficient)', () => {
    const ctx = withGaPa({ coefficients: new Map([['777', { coefficient: 38, savedAt: ago(1) }]]) });
    expect(bestExoFor(cape, buildRankingRow(cape, ctx), ctx)).toBeUndefined();
  });

  it('gives the gain of the item page with that exo, less the price of one rune (SC-007)', () => {
    const ctx = withGaPa();
    const row = buildRankingRow(cape, ctx);
    const exo = bestExoFor(cape, row, ctx);
    expect(exo).toBeDefined();
    const direct = analyzeBrisage(
      { level: 100, lines: [{ effectId: 125, value: averageRoll(40, 44) }, { effectId: 123, value: 38 }, { effectId: exo!.effectId, value: 1, exo: true }], coefficient: 100, itemCostKamas: 800 },
      RUNES, ctx.runePrices, SETTINGS,
    );
    expect(direct.status).toBe('ok');
    if (direct.status !== 'ok') return;
    expect(exo!.gainKamas).toBeCloseTo(direct.best!.gainKamas! - exo!.runePriceKamas, 6);
  });

  it('recommends nothing when no rune of an absent stat has a price', () => {
    const ctx = context({ runePrices: { '1523': 5, '1525': 5 } });
    const row = buildRankingRow(cape, ctx);
    expect(bestExoFor(cape, row, ctx)).toBeUndefined();
  });

  it('recommends nothing for a row without figures', () => {
    const ctx = context({ itemPrices: new Map() });
    const row = buildRankingRow(cape, ctx);
    expect(bestExoFor(cape, row, ctx)).toBeUndefined();
  });

  it('gives a threshold, never a gain, for an unknown coefficient', () => {
    const ctx = withGaPa({ coefficients: new Map() });
    const row = buildRankingRow(cape, ctx);
    const exo = bestExoFor(cape, row, ctx);
    expect(exo).toBeDefined();
    expect(exo!.gainKamas).toBeUndefined();
    expect(exo!.thresholdCoefficient!).toBeLessThan(row.thresholdCoefficient!);
  });
});
