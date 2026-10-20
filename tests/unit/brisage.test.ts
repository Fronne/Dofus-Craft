import { describe, expect, it } from 'vitest';
import runeItems from '../../src/data/rune-items.json';
import type { RuneItem, RuneItemsData } from '../../src/domain/forgemagie';
import {
  BRISAGE_STATS,
  analyzeBrisage,
  averageRoll,
  coefficientDescent,
  defaultBrisageSettings,
  displayedCoefficient,
  lineWeight,
  mergeBrisageSettings,
  minimumProfitableCoefficient,
  nextCoefficient,
  runeForStat,
  runeSizeOf,
  runesForLine,
  wholeRunes,
} from '../../src/domain/brisage';

// specs/060-page-brisage: the formulas are estimates (spec.md H1–H4); these tests pin them and the
// two real readings (Bottes / Cape du Chef Bwork, level 100, coefficient 50 %).
const RUNES = (runeItems as RuneItemsData).runes;
const settings = defaultBrisageSettings();
const VI = 125, INT = 126, AGI = 119, SA = 124, DO = 112, CHA = 123, PM = 128, PRO = 176;

function runeId(effectId: number): string {
  return runeForStat(RUNES, effectId, 'ba')!.rune.id;
}

describe('nextCoefficient', () => {
  it('keeps the decimals: the loss at 100 is about 0.26 point and at 50 about 0.06', () => {
    expect(nextCoefficient(100)).toBeCloseTo(99.738, 2);
    expect(nextCoefficient(50)).toBeCloseTo(49.936, 2);
  });
  it('matches the formula x − (2.63e-5 − 5.958e-10·x)·x²', () => {
    for (const x of [90, 75, 60, 30, 10]) {
      expect(nextCoefficient(x)).toBeCloseTo(x - (2.63e-5 - 5.958e-10 * x) * x * x, 10);
    }
  });
  it('always goes down and stays above 0', () => {
    let x = 100;
    for (let i = 0; i < 200; i++) {
      const next = nextCoefficient(x);
      expect(next).toBeLessThan(x);
      expect(next).toBeGreaterThan(0);
      x = next;
    }
    expect(nextCoefficient(0)).toBe(0);
  });
  it('loses about a third of a point in three breaks at 66 %, so the same value can show several times (66, 66, 65 in game)', () => {
    const afterThree = nextCoefficient(nextCoefficient(nextCoefficient(66)));
    expect(66 - afterThree).toBeGreaterThan(0.3);
    expect(66 - afterThree).toBeLessThan(0.4);
    expect([66, 65.8, 65.7].map(displayedCoefficient)).toEqual([66, 66, 66]);
  });
});

describe('wholeRunes', () => {
  it('rounds to a whole number of runes', () => {
    expect(wholeRunes(51.6)).toBe(52);
    expect(wholeRunes(51.4)).toBe(51);
  });
});

describe('coefficientDescent', () => {
  it('lists the coefficients while they stay at or above the threshold', () => {
    const steps = coefficientDescent(50, 45);
    expect(steps[0]).toBe(50);
    expect(steps.every((c) => c >= 45)).toBe(true);
    expect(nextCoefficient(steps[steps.length - 1])).toBeLessThan(45);
  });
  it('is empty when the coefficient is already under the threshold', () => {
    expect(coefficientDescent(30, 40)).toEqual([]);
  });
  it('is bounded even with a threshold of 0 or less', () => {
    expect(coefficientDescent(100, 0).length).toBeLessThanOrEqual(20000);
    expect(coefficientDescent(100, -5).length).toBeGreaterThan(0);
  });
});

describe('minimumProfitableCoefficient', () => {
  it('is coef × cost ÷ runes value', () => {
    expect(minimumProfitableCoefficient(50, 10000, 21000)).toBeCloseTo(23.81, 2);
  });
  it('is undefined without a value', () => {
    expect(minimumProfitableCoefficient(50, 10000, 0)).toBeUndefined();
  });
});

describe('runes of a line (H2) — Bottes du Chef Bwork niv. 100, coef 50 %', () => {
  const runes = (value: number, effectId: number) => {
    const stat = settings.stats[effectId];
    const weight = lineWeight(value, stat.weight, 100, settings);
    return runesForLine(weight, 0.5, stat.weight * stat.runePoints);
  };
  it('gives the 26 Int, 20 Agi, 7 Vi, 15 Sa observed (±1)', () => {
    expect(Math.floor(runes(35, INT))).toBe(26);
    expect(Math.floor(runes(26, AGI))).toBe(20);
    expect(Math.floor(runes(44, VI))).toBe(7);
    expect(Math.abs(runes(19, SA) - 15)).toBeLessThan(1);
  });
});

describe('analyzeBrisage', () => {
  const cape = { level: 100, coefficient: 50, itemCostKamas: 0, lines: [
    { effectId: VI, value: 44 }, { effectId: CHA, value: 38 }, { effectId: AGI, value: 37 }, { effectId: DO, value: 4 }, { effectId: PRO, value: 5 },
  ] };
  const prices = (overrides: Record<string, number> = {}) => {
    const base: Record<string, number> = {};
    for (const line of cape.lines) base[runeId(line.effectId)] = 10;
    return { ...base, ...overrides };
  };

  it('H3 – a focus on Dommages gives about 6 Do runes (6 observed)', () => {
    const result = analyzeBrisage(cape, RUNES, prices(), settings);
    if (result.status !== 'ok') throw new Error('invalid');
    const focus = result.options.find((o) => o.focusEffectId === DO)!;
    const dommages = focus.yields.find((y) => y.effectId === DO)!;
    expect(dommages.count).toBeCloseTo(6.05, 2);
    // the other lines keep 50 % of their weight, the same as the normal breaking at coef 50 %
    const normal = result.options.find((o) => o.kind === 'normal')!;
    expect(focus.yields.find((y) => y.effectId === VI)!.count).toBeCloseTo(normal.yields.find((y) => y.effectId === VI)!.count, 6);
  });

  it('ranks the focus on an expensive rune first and names it', () => {
    const result = analyzeBrisage({ ...cape, itemCostKamas: 100 }, RUNES, prices({ [runeId(DO)]: 5000 }), settings);
    if (result.status !== 'ok') throw new Error('invalid');
    expect(result.best?.kind).toBe('focus');
    expect(result.best?.focusEffectId).toBe(DO);
    const gains = result.options.map((o) => o.gainKamas!);
    expect([...gains].sort((a, b) => b - a)).toEqual(gains);
  });

  it('keeps the normal breaking best when no rune stands out', () => {
    const input = { level: 100, coefficient: 90, itemCostKamas: 0, lines: [{ effectId: INT, value: 30 }, { effectId: AGI, value: 30 }] };
    const result = analyzeBrisage(input, RUNES, { [runeId(INT)]: 10, [runeId(AGI)]: 10 }, settings);
    if (result.status !== 'ok') throw new Error('invalid');
    expect(result.best?.kind).toBe('normal');
  });

  it('puts options missing a rune price after the priced ones, without a gain', () => {
    const result = analyzeBrisage(cape, RUNES, { [runeId(VI)]: 5, [runeId(CHA)]: 5, [runeId(AGI)]: 5, [runeId(PRO)]: 5 }, settings);
    if (result.status !== 'ok') throw new Error('invalid');
    expect(result.options.every((o) => o.gainKamas === undefined)).toBe(true);
    expect(result.best).toBeUndefined();
    expect(result.thresholdCoefficient).toBeUndefined();
    expect(result.itemsCount).toBeUndefined();
    expect(result.options[0].missingRuneIds).toContain(runeId(DO));
  });

  it('gives the threshold, the number of items and a descent consistent with them', () => {
    const input = { level: 100, coefficient: 50, itemCostKamas: 100, lines: [{ effectId: INT, value: 35 }] };
    const result = analyzeBrisage(input, RUNES, { [runeId(INT)]: 10 }, settings);
    if (result.status !== 'ok') throw new Error('invalid');
    const value = result.options.find((o) => o.kind === 'normal')!.valueKamas;
    expect(result.thresholdCoefficient).toBeCloseTo((50 * 100) / value, 6);
    expect(result.itemsCount).toBe(result.descent.length);
    expect(result.descent[0]).toMatchObject({ index: 1, coefficient: 50 });
    expect(result.descent.every((s) => s.gainKamas >= -1e-9)).toBe(true);
  });

  it('is not profitable (0 item) when the coefficient is under the threshold', () => {
    const input = { level: 100, coefficient: 50, itemCostKamas: 1_000_000, lines: [{ effectId: INT, value: 35 }] };
    const result = analyzeBrisage(input, RUNES, { [runeId(INT)]: 10 }, settings);
    if (result.status !== 'ok') throw new Error('invalid');
    expect(result.itemsCount).toBe(0);
    expect(result.best?.gainKamas).toBeLessThan(0);
  });

  it('ignores unknown stats, non-positive values and reports them', () => {
    const input = { level: 100, coefficient: 50, itemCostKamas: 0, lines: [{ effectId: INT, value: 35 }, { effectId: 999999, value: 3 }, { effectId: AGI, value: -4 }, { effectId: PM, value: 0 }] };
    const result = analyzeBrisage(input, RUNES, { [runeId(INT)]: 10 }, settings);
    if (result.status !== 'ok') throw new Error('invalid');
    expect(result.ignoredEffectIds).toEqual([999999]);
    expect(result.options.filter((o) => o.kind === 'focus')).toHaveLength(1);
  });

  it('merges two lines of the same stat', () => {
    const input = { level: 100, coefficient: 50, itemCostKamas: 0, lines: [{ effectId: INT, value: 10 }, { effectId: INT, value: 25 }] };
    const merged = analyzeBrisage(input, RUNES, { [runeId(INT)]: 1 }, settings);
    const single = analyzeBrisage({ ...input, lines: [{ effectId: INT, value: 35 }] }, RUNES, { [runeId(INT)]: 1 }, settings);
    if (merged.status !== 'ok' || single.status !== 'ok') throw new Error('invalid');
    expect(merged.options[0].yields[0].count).toBeCloseTo(single.options[0].yields[0].count, 9);
  });

  it('rejects invalid inputs', () => {
    const line = [{ effectId: INT, value: 5 }];
    for (const bad of [
      { level: 100, coefficient: 0, itemCostKamas: 1, lines: line },
      { level: 100, coefficient: 4001, itemCostKamas: 1, lines: line },
      { level: 100, coefficient: 50, itemCostKamas: -1, lines: line },
      { level: 0, coefficient: 50, itemCostKamas: 1, lines: line },
      { level: 100, coefficient: 50, itemCostKamas: 1, lines: [] },
    ]) {
      expect(analyzeBrisage(bad, RUNES, {}, settings).status).toBe('invalid');
    }
  });

  it('uses the settings: a bigger level factor gives more runes, a zero-priced rune counts as missing', () => {
    const input = { level: 100, coefficient: 50, itemCostKamas: 0, lines: [{ effectId: INT, value: 35 }] };
    const base = analyzeBrisage(input, RUNES, { [runeId(INT)]: 1 }, settings);
    const more = analyzeBrisage(input, RUNES, { [runeId(INT)]: 1 }, { ...settings, levelFactor: 0.03 });
    const zero = analyzeBrisage(input, RUNES, { [runeId(INT)]: 0 }, settings);
    if (base.status !== 'ok' || more.status !== 'ok' || zero.status !== 'ok') throw new Error('invalid');
    expect(more.options[0].yields[0].count).toBeGreaterThan(base.options[0].yields[0].count);
    expect(zero.options[0].missingRuneIds).toHaveLength(1);
  });
});

describe('stat table and runes', () => {
  it('has a simple rune for every stat except the ones without (flagged by missing runes)', () => {
    const withoutRune = BRISAGE_STATS.filter((s) => !runeForStat(RUNES, s.effectId, 'ba'));
    expect(withoutRune.map((s) => s.label)).toEqual([]);
  });
  it('has unique effect ids and positive weights', () => {
    expect(new Set(BRISAGE_STATS.map((s) => s.effectId)).size).toBe(BRISAGE_STATS.length);
    BRISAGE_STATS.forEach((s) => expect(s.weight).toBeGreaterThan(0));
  });
  it('reads rune sizes from names and falls back to a smaller size', () => {
    const find = (name: string) => RUNES.find((r: RuneItem) => r.name === name)!;
    expect(runeSizeOf(find('Rune Fo'))).toBe('ba');
    expect(runeSizeOf(find('Rune Pa Fo'))).toBe('pa');
    expect(runeSizeOf(find('Rune Ra Fo'))).toBe('ra');
    expect(runeSizeOf(find('Rune Ré Pa'))).toBe('ba');
    expect(runeForStat(RUNES, 118, 'ra')!.rune.name).toBe('Rune Ra Fo');
    expect(runeForStat(RUNES, 115, 'ra')!.size).toBe('ba');
    expect(runeForStat(RUNES, 424242, 'ba')).toBeUndefined();
  });
});

describe('mergeBrisageSettings', () => {
  it('returns the defaults for anything unusable', () => {
    expect(mergeBrisageSettings(null)).toEqual(defaultBrisageSettings());
    expect(mergeBrisageSettings('x')).toEqual(defaultBrisageSettings());
  });
  it('keeps valid fields, drops wrong ones and unknown stats', () => {
    const merged = mergeBrisageSettings({ levelFactor: 0.02, lineBonus: 'a', runeSize: 'ra', stats: { 125: { weight: 0.5 }, 99999: { weight: 3 } } });
    expect(merged.levelFactor).toBe(0.02);
    expect(merged.lineBonus).toBe(1);
    expect(merged.runeSize).toBe('ra');
    expect(merged.stats[125]).toEqual({ weight: 0.5, runePoints: 5 });
    expect(merged.stats[99999]).toBeUndefined();
  });
});

// specs/061-simplification-page-brisage (FR-006): the default roll is the middle of the range, rounded down.
describe('averageRoll', () => {
  it('takes the middle of the range rounded down', () => {
    expect(averageRoll(1, 50)).toBe(25);
    expect(averageRoll(5, 10)).toBe(7);
    expect(averageRoll(8, 8)).toBe(8);
    expect(averageRoll(10, 5)).toBe(7);
  });
});
