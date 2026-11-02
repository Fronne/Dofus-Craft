import type { RuneItem } from '../forgemagie';
import { MAX_COEFFICIENT, coefficientDescent, minimumProfitableCoefficient } from './coefficients';
import { lineWeight, negativeLineWeight, runeForStat, runesForLine } from './runes';
import { brisageStat, defaultBrisageSettings, type BrisageSettings, type RuneSize } from './stats';

// --- Analysis ---

/** specs/066: `exo` marks a line the item does not have by default; it counts like any line but is never a focus target. */
export type BrisageLine = { effectId: number; value: number; exo?: boolean };

/** specs/067: a line with a negative roll (a malus). It gives no rune; it only weighs a little in a focus. */
export type NegativeLine = { effectId: number; value: number };

export type BrisageInput = {
  level: number;
  lines: BrisageLine[];
  /** Negative lines of the item; see negativeLineWeight. */
  negatives?: NegativeLine[];
  /** Current coefficient of the item, in %. */
  coefficient: number;
  itemCostKamas: number;
};

export type RuneYield = {
  effectId: number;
  runeId: string;
  runeName: string;
  runeSize: RuneSize;
  /** Expected number of runes (fractional: it is an average). */
  count: number;
  unitPriceKamas?: number;
  valueKamas?: number;
};

export type BrisageOption = {
  kind: 'normal' | 'focus';
  /** The focused line's stat, for a focus. */
  focusEffectId?: number;
  focusRuneName?: string;
  yields: RuneYield[];
  /** Value of the priced runes; the total only when `missingRuneIds` is empty. */
  valueKamas: number;
  missingRuneIds: string[];
  gainKamas?: number;
};

export type DescentStep = { index: number; coefficient: number; valueKamas: number; gainKamas: number };

export type BrisageAnalysis =
  | { status: 'invalid'; reason: string }
  | {
    status: 'ok';
    /** Best first: complete options by gain, then the options missing a price. */
    options: BrisageOption[];
    best?: BrisageOption;
    thresholdCoefficient?: number;
    /** Same threshold for the best focus. */
    focusThresholdCoefficient?: number;
    itemsCount?: number;
    descent: DescentStep[];
    /** Effects the item has that the table does not know (or without a rune): not counted. */
    ignoredEffectIds: number[];
  };

function statSetting(settings: BrisageSettings, effectId: number) {
  return settings.stats[effectId] ?? brisageStat(effectId);
}

/** Merges lines of the same stat and drops the ones that cannot be broken into a known rune. */
export function usableLines(lines: BrisageLine[], runes: RuneItem[], settings: BrisageSettings) {
  const merged = new Map<number, BrisageLine>();
  const ignored: number[] = [];
  for (const line of lines) {
    if (!(line.value > 0)) continue;
    if (!statSetting(settings, line.effectId) || !runeForStat(runes, line.effectId, settings.runeSize)) {
      if (!ignored.includes(line.effectId)) ignored.push(line.effectId);
      continue;
    }
    const known = merged.get(line.effectId);
    // specs/067: two lines of one stat stay an exo only when both are; an original line is never made unfocusable by an exo.
    merged.set(line.effectId, { effectId: line.effectId, value: (known?.value ?? 0) + line.value, exo: (known ? known.exo && line.exo : line.exo) || undefined });
  }
  return { lines: [...merged.values()], ignored };
}

/** specs/067: the negative lines whose stat has a weight and a rune, like a positive line; the others are left out. */
export function usableNegatives(negatives: NegativeLine[] | undefined, runes: RuneItem[], settings: BrisageSettings): NegativeLine[] {
  return (negatives ?? []).filter((line) => line.value < 0
    && statSetting(settings, line.effectId) !== undefined
    && runeForStat(runes, line.effectId, settings.runeSize) !== undefined);
}

export function buildOption(
  kind: BrisageOption['kind'],
  focusEffectId: number | undefined,
  lines: BrisageLine[],
  /** Share of the coefficient that applies (1 = 100 %). */
  scale: number,
  input: BrisageInput,
  runes: RuneItem[],
  prices: Record<string, number | undefined>,
  settings: BrisageSettings,
  negatives: NegativeLine[] = [],
): BrisageOption {
  const yields: RuneYield[] = [];
  const missing: string[] = [];
  let value = 0;
  // DoFocus model (docs/dofocus-brisage.md): a focus puts the target's whole weight plus a share of the other lines' weight
  // into the target rune; the other lines give nothing. Everything is scaled by the coefficient.
  const weightOf = (line: BrisageLine) => lineWeight(line.value, statSetting(settings, line.effectId)!.weight, input.level, settings);
  // specs/067: a negative line adds its bounded weight (often 0) at the "other lines" share; it never gives a rune.
  const negativeWeight = negatives.reduce(
    (sum, line) => sum + negativeLineWeight(line.value, statSetting(settings, line.effectId)!.weight, input.level, settings) * settings.focusOtherShare, 0,
  );
  const focusWeight = focusEffectId === undefined ? 0 : lines.reduce(
    (sum, line) => sum + weightOf(line) * (line.effectId === focusEffectId ? settings.focusTargetShare : settings.focusOtherShare), negativeWeight,
  );
  for (const line of lines) {
    const setting = statSetting(settings, line.effectId)!;
    const { rune, size } = runeForStat(runes, line.effectId, settings.runeSize)!;
    const runeWeight = setting.weight * setting.runePoints * settings.sizeMultipliers[size];
    const count = focusEffectId === undefined
      ? runesForLine(weightOf(line), scale, runeWeight)
      : line.effectId === focusEffectId ? runesForLine(focusWeight, scale, runeWeight) : 0;
    const unit = prices[rune.id];
    const priced = typeof unit === 'number' && unit > 0;
    if (count > 0 && !priced) missing.push(rune.id);
    else if (count > 0 && priced) value += count * unit;
    yields.push({
      effectId: line.effectId, runeId: rune.id, runeName: rune.name, runeSize: size, count,
      unitPriceKamas: priced ? unit : undefined, valueKamas: priced ? count * unit : undefined,
    });
  }
  const focusRune = focusEffectId === undefined ? undefined : yields.find((y) => y.effectId === focusEffectId)?.runeName;
  return {
    kind, focusEffectId, focusRuneName: focusRune, yields, valueKamas: value, missingRuneIds: missing,
    gainKamas: missing.length === 0 ? value - input.itemCostKamas : undefined,
  };
}

/** Compares the normal breaking with a focus on each line, and walks the coefficient down item by item. */
export function analyzeBrisage(
  input: BrisageInput,
  runes: RuneItem[],
  prices: Record<string, number | undefined>,
  settings: BrisageSettings = defaultBrisageSettings(),
): BrisageAnalysis {
  const { lines, ignored } = usableLines(input.lines, runes, settings);
  if (lines.length === 0) return { status: 'invalid', reason: "L'objet n'a aucune ligne exploitable." };
  if (!(input.coefficient > 0 && input.coefficient <= MAX_COEFFICIENT)) return { status: 'invalid', reason: `Le coefficient doit être supérieur à 0 et au plus ${MAX_COEFFICIENT} %.` };
  if (!(input.itemCostKamas >= 0)) return { status: 'invalid', reason: "Saisissez le coût de l'objet (0 s'il ne coûte rien)." };
  if (!(input.level >= 1)) return { status: 'invalid', reason: "Le niveau de l'objet doit être au moins 1." };

  const scale = input.coefficient / 100;
  const normal = buildOption('normal', undefined, lines, scale, input, runes, prices, settings);
  const negatives = usableNegatives(input.negatives, runes, settings);
  const focuses = lines.filter((line) => !line.exo).map((line) => buildOption('focus', line.effectId, lines, scale, input, runes, prices, settings, negatives));
  const all = [normal, ...focuses];
  const complete = all.filter((o) => o.gainKamas !== undefined).sort((a, b) => b.gainKamas! - a.gainKamas!);
  const incomplete = all.filter((o) => o.gainKamas === undefined);
  const options = [...complete, ...incomplete];

  let thresholdCoefficient: number | undefined;
  let focusThresholdCoefficient: number | undefined;
  let itemsCount: number | undefined;
  let descent: DescentStep[] = [];
  const bestFocus = complete.find((option) => option.kind === 'focus');
  if (bestFocus) focusThresholdCoefficient = minimumProfitableCoefficient(input.coefficient, input.itemCostKamas, bestFocus.valueKamas);
  if (normal.gainKamas !== undefined) {
    thresholdCoefficient = minimumProfitableCoefficient(input.coefficient, input.itemCostKamas, normal.valueKamas);
    if (thresholdCoefficient !== undefined) {
      const steps = coefficientDescent(input.coefficient, thresholdCoefficient);
      descent = steps.map((coefficient, index) => {
        const value = (normal.valueKamas * coefficient) / input.coefficient;
        return { index: index + 1, coefficient, valueKamas: value, gainKamas: value - input.itemCostKamas };
      });
      itemsCount = steps.length;
    }
  }
  return { status: 'ok', options, best: complete[0], thresholdCoefficient, focusThresholdCoefficient, itemsCount, descent, ignoredEffectIds: ignored };
}
