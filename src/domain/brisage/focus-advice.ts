import type { RuneItem } from '../forgemagie';
import { buildOption, usableLines, usableNegatives, type BrisageInput, type BrisageLine, type BrisageOption, type NegativeLine } from './analysis';
import { defaultBrisageSettings, type BrisageSettings } from './stats';

// specs/063-brisage-sans-coefficient, corrected by the DoFocus focus model (docs/dofocus-brisage.md): advice when the coefficient is unknown.
// Normal breaking and focus are both proportional to the coefficient, so which of the two pays more does
// not depend on it. The price of the item only moves the coefficient below which breaking stops paying.

export type FocusAdviceInput = { level: number; lines: BrisageLine[]; negatives?: NegativeLine[]; itemCostKamas?: number };

export type FocusAdvice =
  | { status: 'invalid'; reason: string }
  | {
    status: 'ok';
    /** The normal breaking computed as if the coefficient were 100 %. */
    reference: BrisageOption;
    focusOptions: BrisageOption[];
    /** The priced focus worth the most (first line wins a tie); absent while a rune has no price. */
    bestFocus?: BrisageOption;
    /** Whether the best focus is worth more than breaking normally (at any coefficient). */
    focusBeatsNormal?: boolean;
    /** Coefficient (%) under which breaking normally no longer covers the item price; needs `itemCostKamas`. */
    normalBreakEven?: number;
    /** Same for the best focus. */
    focusBreakEven?: number;
    missingRuneIds: string[];
  };

export function analyzeFocusAdvice(
  input: FocusAdviceInput,
  runes: RuneItem[],
  prices: Record<string, number | undefined>,
  settings: BrisageSettings = defaultBrisageSettings(),
): FocusAdvice {
  const { lines } = usableLines(input.lines, runes, settings);
  if (lines.length === 0) return { status: 'invalid', reason: "L'objet n'a aucune ligne exploitable." };
  if (!(input.level >= 1)) return { status: 'invalid', reason: "Le niveau de l'objet doit être au moins 1." };

  const base: BrisageInput = { level: input.level, lines, coefficient: 100, itemCostKamas: 0 };
  const reference = buildOption('normal', undefined, lines, 1, base, runes, prices, settings);
  const negatives = usableNegatives(input.negatives, runes, settings);
  const focusOptions = lines.filter((line) => !line.exo).map((line) => buildOption('focus', line.effectId, lines, 1, base, runes, prices, settings, negatives));
  const priced = focusOptions.filter((option) => option.missingRuneIds.length === 0);
  const bestFocus = priced.reduce<BrisageOption | undefined>((best, option) => (!best || option.valueKamas > best.valueKamas ? option : best), undefined);
  const referenceKnown = reference.missingRuneIds.length === 0;
  // Undefined (no advice) while the runes are worth nothing: neither choice pays.
  const focusBeatsNormal = bestFocus && referenceKnown && Math.max(bestFocus.valueKamas, reference.valueKamas) > 0
    ? bestFocus.valueKamas > reference.valueKamas
    : undefined;
  const cost = input.itemCostKamas;
  const breakEven = (option: BrisageOption | undefined) => (
    option && option.missingRuneIds.length === 0 && option.valueKamas > 0 && typeof cost === 'number' && cost >= 0
      ? (100 * cost) / option.valueKamas
      : undefined
  );
  const missingRuneIds = [...new Set([...reference.missingRuneIds, ...focusOptions.flatMap((o) => o.missingRuneIds)])];
  return {
    status: 'ok', reference, focusOptions, bestFocus, focusBeatsNormal,
    normalBreakEven: breakEven(reference), focusBreakEven: breakEven(bestFocus), missingRuneIds,
  };
}
