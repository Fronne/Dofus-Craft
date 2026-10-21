import { describe, expect, it } from 'vitest';
import runeItems from '../../src/data/rune-items.json';
import type { RuneItemsData } from '../../src/domain/forgemagie';
import { analyzeBrisage, analyzeFocusAdvice, runeForStat } from '../../src/domain/brisage';

// specs/063-brisage-sans-coefficient: best focus and switch coefficient without a known coefficient.
const RUNES = (runeItems as RuneItemsData).runes;
const VI = 125, CHA = 123, DO = 112;
const runeId = (effectId: number) => runeForStat(RUNES, effectId, 'ba')!.rune.id;
const prices = { [runeId(VI)]: 5, [runeId(CHA)]: 5, [runeId(DO)]: 3000 };
const lines = [{ effectId: VI, value: 42 }, { effectId: CHA, value: 38 }, { effectId: DO, value: 5 }];
const ok = (advice: ReturnType<typeof analyzeFocusAdvice>) => {
  if (advice.status !== 'ok') throw new Error(advice.reason);
  return advice;
};

describe('analyzeFocusAdvice', () => {
  it('picks the priced focus worth the most and says it beats the normal breaking', () => {
    const advice = ok(analyzeFocusAdvice({ level: 100, lines }, RUNES, prices));
    const best = Math.max(...advice.focusOptions.map((o) => o.valueKamas));
    expect(advice.bestFocus?.valueKamas).toBe(best);
    expect(advice.bestFocus?.focusEffectId).toBe(DO);
    expect(advice.focusBeatsNormal).toBe(best > advice.reference.valueKamas);
  });

  it('gives no advice while a rune has no price', () => {
    const advice = ok(analyzeFocusAdvice({ level: 100, lines, itemCostKamas: 1000 }, RUNES, { ...prices, [runeId(DO)]: undefined }));
    expect(advice.focusBeatsNormal).toBeUndefined();
    expect(advice.normalBreakEven).toBeUndefined();
    expect(advice.missingRuneIds).toEqual([runeId(DO)]);
  });

  it('works with a single line: the focus is the normal breaking', () => {
    const advice = ok(analyzeFocusAdvice({ level: 100, lines: [{ effectId: DO, value: 5 }] }, RUNES, prices));
    expect(advice.bestFocus?.focusEffectId).toBe(DO);
    expect(advice.focusBeatsNormal).toBe(false);
  });

  it('keeps the first line on a tie', () => {
    const AGI = 119;
    const same = { [runeId(CHA)]: 7, [runeId(AGI)]: 7 };
    const advice = ok(analyzeFocusAdvice({ level: 100, lines: [{ effectId: CHA, value: 10 }, { effectId: AGI, value: 10 }] }, RUNES, same));
    expect(advice.bestFocus?.focusEffectId).toBe(CHA);
  });

  it('gives no break-even when the item price is unknown or the runes are worth nothing', () => {
    expect(ok(analyzeFocusAdvice({ level: 100, lines }, RUNES, prices)).normalBreakEven).toBeUndefined();
    const free = ok(analyzeFocusAdvice({ level: 100, lines, itemCostKamas: 1000 }, RUNES, { [runeId(VI)]: 0, [runeId(CHA)]: 0, [runeId(DO)]: 0 }));
    expect(free.normalBreakEven).toBeUndefined();
  });

  it('is invalid without usable line or level', () => {
    expect(analyzeFocusAdvice({ level: 100, lines: [] }, RUNES, prices).status).toBe('invalid');
    expect(analyzeFocusAdvice({ level: NaN, lines }, RUNES, prices).status).toBe('invalid');
  });

  it('gives the coefficient under which breaking no longer covers the item price', () => {
    const cost = 20000;
    const advice = ok(analyzeFocusAdvice({ level: 100, lines, itemCostKamas: cost }, RUNES, prices));
    expect(advice.normalBreakEven).toBeCloseTo((100 * cost) / advice.reference.valueKamas, 6);
    expect(advice.focusBreakEven).toBeCloseTo((100 * cost) / advice.bestFocus!.valueKamas, 6);
  });

  it('agrees with the full analysis at every coefficient: the better option and the break-even do not move', () => {
    const cost = 20000;
    const advice = ok(analyzeFocusAdvice({ level: 100, lines, itemCostKamas: cost }, RUNES, prices));
    const at = (coefficient: number) => analyzeBrisage({ level: 100, lines, coefficient, itemCostKamas: cost }, RUNES, prices);
    for (const coefficient of [20, 60, 100, 180]) {
      const result = at(coefficient);
      if (result.status !== 'ok') throw new Error('invalid');
      expect(result.best?.kind).toBe(advice.focusBeatsNormal ? 'focus' : 'normal');
    }
    const edge = advice.normalBreakEven!;
    const below = at(edge - 1), above = at(edge + 1);
    if (below.status !== 'ok' || above.status !== 'ok') throw new Error('invalid');
    expect(below.options.find((o) => o.kind === 'normal')!.gainKamas!).toBeLessThan(0);
    expect(above.options.find((o) => o.kind === 'normal')!.gainKamas!).toBeGreaterThan(0);
  });
});

describe('focus scales with the coefficient (DoFocus model)', () => {
  it('halves the runes of a focus when the coefficient halves', () => {
    const run = (coefficient: number) => {
      const r = analyzeBrisage({ level: 100, lines, coefficient, itemCostKamas: 0 }, RUNES, prices);
      if (r.status !== 'ok') throw new Error('invalid');
      return r.options.find((o) => o.kind === 'focus' && o.focusEffectId === DO)!.valueKamas;
    };
    expect(run(50)).toBeCloseTo(run(100) / 2, 6);
  });
});
