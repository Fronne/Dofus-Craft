import { describe, expect, it } from 'vitest';
import runeItems from '../../src/data/rune-items.json';
import type { RuneItemsData } from '../../src/domain/forgemagie';
import {
  analyzeBrisage, analyzeFocusAdvice, brisageStat, defaultBrisageSettings, negativeLineWeight, negativeStatId, runeForStat,
} from '../../src/domain/brisage';

// specs/067-brisage-lignes-negatives: a negative line weighs like a positive one (never below 0), gives no rune,
// is never a focus target and counts for half in a focus (Kama Master).
const RUNES = (runeItems as RuneItemsData).runes;
const VI = 125, FO = 118, CHA = 123;
const SETTINGS = defaultBrisageSettings();
const runeId = (effectId: number) => runeForStat(RUNES, effectId, 'ba')!.rune.id;
const prices = { [runeId(VI)]: 5, [runeId(FO)]: 10, [runeId(CHA)]: 5 };
const base = [{ effectId: VI, value: 42 }, { effectId: CHA, value: 38 }];
const input = (level: number, extra: { negatives?: { effectId: number; value: number }[]; lines?: typeof base } = {}) => ({
  level, lines: extra.lines ?? base, negatives: extra.negatives, coefficient: 80, itemCostKamas: 1000,
});
const ok = (analysis: ReturnType<typeof analyzeBrisage>) => {
  if (analysis.status !== 'ok') throw new Error(analysis.reason);
  return analysis;
};
const focusOn = (analysis: ReturnType<typeof ok>, effectId: number) => analysis.options.find((o) => o.kind === 'focus' && o.focusEffectId === effectId)!;
const normalOf = (analysis: ReturnType<typeof ok>) => analysis.options.find((o) => o.kind === 'normal')!;

describe('negativeStatId', () => {
  it('maps the malus effects of DofusDB to the stat they take away, and leaves other ids alone', () => {
    expect(negativeStatId(157)).toBe(FO);
    expect(negativeStatId(153)).toBe(VI);
    expect(negativeStatId(168)).toBe(111);
    expect(negativeStatId(FO)).toBe(FO);
    expect(negativeStatId(2893)).toBe(2893);
  });

  it('only points at stats the Brisage table knows, with a rune', () => {
    for (const malus of [116, 145, 152, 153, 154, 155, 156, 157, 159, 162, 163, 168, 169, 171, 175, 177, 179, 186, 215, 216, 217, 218, 219, 245, 246, 247, 248, 249,
      411, 413, 415, 417, 419, 421, 423, 425, 427, 429, 431, 754, 755, 2801, 2802, 2805, 2806, 2809, 2813, 2990]) {
      const stat = negativeStatId(malus);
      expect(stat, `malus ${malus}`).not.toBe(malus);
      expect(brisageStat(stat), `stat ${stat} of malus ${malus}`).toBeDefined();
      expect(runeForStat(RUNES, stat, 'ba'), `rune of stat ${stat}`).toBeDefined();
    }
  });
});

describe('negativeLineWeight', () => {
  it('is brought back to 0 when the line is heavy (level 200, Force -10)', () => {
    expect(negativeLineWeight(-10, 1, 200, SETTINGS)).toBe(0);
  });

  it('keeps the positive remainder of a light malus (level 20, Force -1)', () => {
    expect(negativeLineWeight(-1, 1, 20, SETTINGS)).toBeCloseTo(0.7, 10);
  });
});

describe('negative lines in the analysis', () => {
  it('adds half of the weight of a light malus to a focus on another line', () => {
    const without = ok(analyzeBrisage(input(20), RUNES, prices));
    const withMalus = ok(analyzeBrisage(input(20, { negatives: [{ effectId: FO, value: -1 }] }), RUNES, prices));
    const runeWeight = SETTINGS.stats[VI].weight * SETTINGS.stats[VI].runePoints;
    const gained = focusOn(withMalus, VI).yields.find((y) => y.effectId === VI)!.count - focusOn(without, VI).yields.find((y) => y.effectId === VI)!.count;
    expect(gained).toBeCloseTo((0.7 * SETTINGS.focusOtherShare * 0.8) / runeWeight, 10);
  });

  it('changes nothing for a heavy malus, in a focus or in a normal breaking', () => {
    const without = ok(analyzeBrisage(input(200), RUNES, prices));
    const withMalus = ok(analyzeBrisage(input(200, { negatives: [{ effectId: FO, value: -10 }] }), RUNES, prices));
    expect(focusOn(withMalus, VI).valueKamas).toBeCloseTo(focusOn(without, VI).valueKamas, 10);
    expect(normalOf(withMalus).valueKamas).toBeCloseTo(normalOf(without).valueKamas, 10);
  });

  it('leaves the normal breaking identical with and without a malus', () => {
    const without = ok(analyzeBrisage(input(20), RUNES, prices));
    const withMalus = ok(analyzeBrisage(input(20, { negatives: [{ effectId: FO, value: -1 }] }), RUNES, prices));
    expect(normalOf(withMalus).valueKamas).toBeCloseTo(normalOf(without).valueKamas, 10);
    expect(normalOf(withMalus).yields).toEqual(normalOf(without).yields);
  });

  it('never makes a total smaller, whatever the malus', () => {
    const without = ok(analyzeBrisage(input(20), RUNES, prices));
    for (const value of [-1, -5, -50]) {
      const withMalus = ok(analyzeBrisage(input(20, { negatives: [{ effectId: FO, value }] }), RUNES, prices));
      expect(focusOn(withMalus, VI).valueKamas).toBeGreaterThanOrEqual(focusOn(without, VI).valueKamas);
      expect(normalOf(withMalus).valueKamas).toBeGreaterThanOrEqual(normalOf(without).valueKamas);
    }
  });

  it('gives no rune for a malus and never offers a focus on it', () => {
    const analysis = ok(analyzeBrisage(input(20, { negatives: [{ effectId: FO, value: -1 }] }), RUNES, prices));
    expect(analysis.options.flatMap((o) => o.yields).some((y) => y.effectId === FO)).toBe(false);
    expect(analysis.options.filter((o) => o.kind === 'focus').map((o) => o.focusEffectId).sort()).toEqual([VI, CHA].sort());
  });

  it('keeps a positive and a negative line of the same stat apart', () => {
    const analysis = ok(analyzeBrisage(input(20, { negatives: [{ effectId: VI, value: -3 }] }), RUNES, prices));
    expect(normalOf(analysis).yields.filter((y) => y.effectId === VI)).toHaveLength(1);
    expect(normalOf(analysis).yields.find((y) => y.effectId === VI)!.count)
      .toBeCloseTo(normalOf(ok(analyzeBrisage(input(20), RUNES, prices))).yields.find((y) => y.effectId === VI)!.count, 10);
  });

  it('refuses an item that only has negative lines', () => {
    const analysis = analyzeBrisage(input(20, { lines: [], negatives: [{ effectId: FO, value: -1 }] }), RUNES, prices);
    expect(analysis.status).toBe('invalid');
  });

  it('ignores a malus whose stat has no weight or no rune', () => {
    const without = ok(analyzeBrisage(input(20), RUNES, prices));
    const withUnknown = ok(analyzeBrisage(input(20, { negatives: [{ effectId: 999999, value: -1 }] }), RUNES, prices));
    expect(focusOn(withUnknown, VI).valueKamas).toBeCloseTo(focusOn(without, VI).valueKamas, 10);
  });
});

describe('negative lines in the focus advice (unknown coefficient)', () => {
  it('weighs a light malus in the focus and leaves the normal breaking alone', () => {
    const advice = (negatives?: { effectId: number; value: number }[]) => {
      const result = analyzeFocusAdvice({ level: 20, lines: base, negatives }, RUNES, prices);
      if (result.status !== 'ok') throw new Error(result.reason);
      return result;
    };
    const without = advice();
    const withMalus = advice([{ effectId: FO, value: -1 }]);
    expect(withMalus.reference.valueKamas).toBeCloseTo(without.reference.valueKamas, 10);
    const focusValue = (a: ReturnType<typeof advice>) => a.focusOptions.find((o) => o.focusEffectId === VI)!.valueKamas;
    expect(focusValue(withMalus)).toBeGreaterThan(focusValue(without));
  });

  it('refuses an item that only has negative lines', () => {
    const result = analyzeFocusAdvice({ level: 20, lines: [], negatives: [{ effectId: FO, value: -1 }] }, RUNES, prices);
    expect(result.status).toBe('invalid');
  });
});
