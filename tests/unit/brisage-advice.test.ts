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
  it('picks the priced focus worth the most and gives the switch coefficient', () => {
    const advice = ok(analyzeFocusAdvice({ level: 100, lines }, RUNES, prices));
    const best = Math.max(...advice.focusOptions.map((o) => o.valueKamas));
    expect(advice.bestFocus?.valueKamas).toBe(best);
    expect(advice.bestFocus?.focusEffectId).toBe(DO);
    expect(advice.switchCoefficient).toBeCloseTo((100 * best) / advice.reference.valueKamas, 6);
  });

  it('gives no advice while a rune has no price', () => {
    const advice = ok(analyzeFocusAdvice({ level: 100, lines }, RUNES, { ...prices, [runeId(DO)]: undefined }));
    expect(advice.bestFocus).toBeUndefined();
    expect(advice.switchCoefficient).toBeUndefined();
    expect(advice.missingRuneIds).toEqual([runeId(DO)]);
  });

  it('works with a single line', () => {
    const advice = ok(analyzeFocusAdvice({ level: 100, lines: [{ effectId: DO, value: 5 }] }, RUNES, prices));
    expect(advice.bestFocus?.focusEffectId).toBe(DO);
    // The only line gets 100 % in a focus and 100 % in the reference: they meet at 100 %.
    expect(advice.switchCoefficient).toBeCloseTo(100, 6);
  });

  it('keeps the first line on a tie', () => {
    const AGI = 119;
    const same = { [runeId(CHA)]: 7, [runeId(AGI)]: 7 };
    const advice = ok(analyzeFocusAdvice({ level: 100, lines: [{ effectId: CHA, value: 10 }, { effectId: AGI, value: 10 }] }, RUNES, same));
    expect(advice.bestFocus?.focusEffectId).toBe(CHA);
  });

  it('gives no switch coefficient when the reference is worth nothing', () => {
    const advice = ok(analyzeFocusAdvice({ level: 100, lines }, RUNES, { [runeId(VI)]: 0, [runeId(CHA)]: 0, [runeId(DO)]: 0 }));
    expect(advice.switchCoefficient).toBeUndefined();
  });

  it('is invalid without usable line or level', () => {
    expect(analyzeFocusAdvice({ level: 100, lines: [] }, RUNES, prices).status).toBe('invalid');
    expect(analyzeFocusAdvice({ level: NaN, lines }, RUNES, prices).status).toBe('invalid');
  });

  it('agrees with the full analysis on both sides of the switch coefficient', () => {
    const advice = ok(analyzeFocusAdvice({ level: 100, lines }, RUNES, prices));
    const at = (coefficient: number) => analyzeBrisage({ level: 100, lines, coefficient, itemCostKamas: 1000 }, RUNES, prices);
    const switchAt = advice.switchCoefficient!;
    const below = at(switchAt - 1);
    const above = at(switchAt + 1);
    if (below.status !== 'ok' || above.status !== 'ok') throw new Error('invalid');
    expect(below.best?.kind).toBe('focus');
    expect(above.best?.kind).toBe('normal');
  });
});
