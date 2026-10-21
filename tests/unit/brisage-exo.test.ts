import { describe, expect, it } from 'vitest';
import runeItems from '../../src/data/rune-items.json';
import type { RuneItemsData } from '../../src/domain/forgemagie';
import {
  analyzeBrisage, analyzeFocusAdvice, defaultBrisageSettings, isRollAllowed, lineValueLimit, maxValueForWeight, runeForStat,
} from '../../src/domain/brisage';

// specs/066-exo-brisage: an exo is a separate line, never a focus target; exos and overs weigh at most 101.
const RUNES = (runeItems as RuneItemsData).runes;
const VI = 125, FO = 118, CHA = 123, SA = 124, PA = 111;
const runeId = (effectId: number) => runeForStat(RUNES, effectId, 'ba')!.rune.id;
const prices = { [runeId(VI)]: 5, [runeId(FO)]: 10, [runeId(CHA)]: 5, [runeId(SA)]: 20, [runeId(PA)]: 9000 };
const base = [{ effectId: VI, value: 42 }, { effectId: CHA, value: 38 }];
const input = (lines: { effectId: number; value: number; exo?: boolean }[]) => ({ level: 100, lines, coefficient: 80, itemCostKamas: 1000 });
const ok = (analysis: ReturnType<typeof analyzeBrisage>) => {
  if (analysis.status !== 'ok') throw new Error(analysis.reason);
  return analysis;
};

describe('exo in the analysis', () => {
  it('adds the runes of the exo to the normal breaking, as a line of its own', () => {
    const without = ok(analyzeBrisage(input(base), RUNES, prices));
    const withExo = ok(analyzeBrisage(input([{ exo: true, effectId: FO, value: 5 }, ...base]), RUNES, prices));
    const normalWithout = without.options.find((o) => o.kind === 'normal')!;
    const normalWith = withExo.options.find((o) => o.kind === 'normal')!;
    const exoYield = normalWith.yields.find((y) => y.effectId === FO)!;
    expect(exoYield.count).toBeGreaterThan(0);
    expect(normalWith.valueKamas).toBeCloseTo(normalWithout.valueKamas + exoYield.valueKamas!, 6);
    expect(normalWith.gainKamas).toBeCloseTo(normalWithout.gainKamas! + exoYield.valueKamas!, 6);
  });

  it('uses the same weight formula as any other line', () => {
    const asLine = ok(analyzeBrisage(input([{ effectId: FO, value: 5 }]), RUNES, prices));
    const asExo = ok(analyzeBrisage(input([{ exo: true, effectId: FO, value: 5 }]), RUNES, prices));
    expect(asExo.options.find((o) => o.kind === 'normal')!.valueKamas)
      .toBeCloseTo(asLine.options.find((o) => o.kind === 'normal')!.valueKamas, 6);
  });

  it('never offers a focus on an exo', () => {
    const analysis = ok(analyzeBrisage(input([{ exo: true, effectId: FO, value: 5 }, ...base]), RUNES, prices));
    const focuses = analysis.options.filter((o) => o.kind === 'focus');
    expect(focuses.map((o) => o.focusEffectId).sort()).toEqual([VI, CHA].sort());
  });

  it('counts the exo at the share of the other lines when another line is focused', () => {
    const settings = defaultBrisageSettings();
    const analysis = ok(analyzeBrisage(input([{ exo: true, effectId: FO, value: 5 }, ...base]), RUNES, prices, settings));
    const normal = analysis.options.find((o) => o.kind === 'normal')!;
    const focus = analysis.options.find((o) => o.kind === 'focus' && o.focusEffectId === VI)!;
    const full = normal.yields.find((y) => y.effectId === FO)!.count / 0.8;
    expect(focus.yields.find((y) => y.effectId === FO)!.count).toBeCloseTo(full * settings.focusOtherShare, 6);
  });

  it('keeps the threshold and the descent consistent with the exo value', () => {
    const analysis = ok(analyzeBrisage(input([{ exo: true, effectId: PA, value: 1 }, ...base]), RUNES, prices));
    const normal = analysis.options.find((o) => o.kind === 'normal')!;
    expect(analysis.thresholdCoefficient).toBeCloseTo((80 * 1000) / normal.valueKamas, 6);
    expect(analysis.descent[0].valueKamas).toBeCloseTo(normal.valueKamas, 6);
  });

  it('flags a missing rune price of an exo instead of counting it as zero', () => {
    const analysis = ok(analyzeBrisage(input([{ exo: true, effectId: FO, value: 5 }, ...base]), RUNES, { ...prices, [runeId(FO)]: undefined }));
    const normal = analysis.options.find((o) => o.kind === 'normal')!;
    expect(normal.missingRuneIds).toContain(runeId(FO));
    expect(normal.gainKamas).toBeUndefined();
  });

  it('changes nothing for an item without exo', () => {
    const a = ok(analyzeBrisage(input(base), RUNES, prices));
    const b = ok(analyzeBrisage(input(base.map((l) => ({ ...l, exo: undefined }))), RUNES, prices));
    expect(b).toEqual(a);
  });
});

describe('exo in the focus advice', () => {
  const advice = (lines: { effectId: number; value: number; exo?: boolean }[]) => {
    const result = analyzeFocusAdvice({ level: 100, lines }, RUNES, prices);
    if (result.status !== 'ok') throw new Error(result.reason);
    return result;
  };

  it('offers no focus on the exo but counts it in the reference and in the switch coefficient', () => {
    const lines = [{ exo: true, effectId: SA, value: 10 }, ...base];
    const withExo = advice(lines);
    const without = advice(base);
    expect(withExo.focusOptions.map((o) => o.focusEffectId)).not.toContain(SA);
    expect(withExo.reference.valueKamas).toBeGreaterThan(without.reference.valueKamas);
    expect(withExo.switchCoefficient).not.toBeCloseTo(without.switchCoefficient!, 6);
  });
});

describe('weight limit', () => {
  it('gives the biggest value under 101', () => {
    expect(maxValueForWeight(1)).toBe(101);
    expect(maxValueForWeight(100)).toBe(1);
    expect(maxValueForWeight(0.2)).toBe(505);
    expect(maxValueForWeight(0.25)).toBe(404);
    expect(maxValueForWeight(0.1)).toBe(1010);
    expect(maxValueForWeight(3)).toBe(33);
    expect(maxValueForWeight(0)).toBe(0);
  });

  const settings = defaultBrisageSettings();

  it('limits an exo by its stat weight and an over by the natural maximum when it is higher', () => {
    expect(lineValueLimit(FO, settings)).toBe(101);
    expect(lineValueLimit(PA, settings)).toBe(1);
    expect(lineValueLimit(SA, settings)).toBe(33);
    expect(lineValueLimit(SA, settings, 60)).toBe(60);
    expect(lineValueLimit(FO, settings, 30)).toBe(101);
  });

  it('accepts a whole number from 1 for an exo, any number from 0 for an over, never above the limit', () => {
    expect(isRollAllowed(5, 101, { exo: true })).toBe(true);
    expect(isRollAllowed(101, 101, { exo: true })).toBe(true);
    expect(isRollAllowed(102, 101, { exo: true })).toBe(false);
    expect(isRollAllowed(0, 101, { exo: true })).toBe(false);
    expect(isRollAllowed(-1, 101, { exo: true })).toBe(false);
    expect(isRollAllowed(2.5, 101, { exo: true })).toBe(false);
    expect(isRollAllowed(Number.NaN, 101, { exo: true })).toBe(false);
    expect(isRollAllowed(33, 101)).toBe(true);
    expect(isRollAllowed(0, 101)).toBe(true);
    expect(isRollAllowed(-1, 101)).toBe(false);
    expect(isRollAllowed(102, 101)).toBe(false);
  });
});
