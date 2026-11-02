import {
  analyzeBrisage,
  analyzeFocusAdvice,
  BRISAGE_STATS,
  lineValueLimit,
  runeForStat,
} from '../../domain/brisage';
import { bestExoFor, buildRankingRow, type RankingContext } from '../../domain/brisage-ranking';
import type { IndexedItem } from '../../domain/brisage-search';
import type { ExoRuneChoice } from './ExoRow';
import type { BrisageLines } from './brisageLines';
import { nextCoefficients, RUNES, SETTINGS, shortRune, type PickedItem, type Range } from './brisageHelpers';

export type BrisageVerdict = { title: string; hint: string | undefined; tone: 'good' | 'bad' | 'neutral' };

/** The verdict, the advice, the best exo and the figures of the footer, worked out from the lines and the prices. */
export function analyseBrisageItem({ item, ranges, negativeRanges, exos, lines, prices, priceLoading, cost, coefficient }: {
  item: PickedItem | undefined;
  ranges: Range[];
  negativeRanges: Range[];
  exos: { effectId: number; value: number }[];
  lines: BrisageLines;
  prices: Record<string, number | undefined>;
  priceLoading: boolean;
  cost: number;
  coefficient: number;
}) {
  const { lines: positiveLines, negativeLines, flippedLines } = lines;
  // The exo that pays the most when put on the item as it is (average rolls, no exo of the table); nothing when none pays more.
  const bestExo = (() => {
    if (!item || !(item.level !== undefined && item.level > 0) || ranges.length === 0 || !(cost > 0) || priceLoading) return undefined;
    const indexed: IndexedItem = { id: item.id, name: item.name, level: item.level, effects: ranges };
    const context: RankingContext = {
      runes: RUNES, settings: SETTINGS, runePrices: prices, runePriceDates: {},
      itemPrices: new Map([[item.id, { kamas: cost }]]),
      coefficients: coefficient > 0 ? new Map([[item.id, { coefficient, savedAt: '' }]]) : new Map(),
    };
    return bestExoFor(indexed, buildRankingRow(indexed, context), context, negativeRanges.map((range) => range.effectId));
  })();
  // Once the exo is in the table it is no longer offered.
  const offeredExo = bestExo && !exos.some((exo) => exo.effectId === bestExo.effectId) ? bestExo : undefined;

  const ready = item && (ranges.length > 0 || flippedLines.length > 0) && !priceLoading;
  const lineInputs = [
    ...exos.map((exo) => ({ effectId: exo.effectId, value: exo.value, exo: true })),
    ...positiveLines.map((line) => ({ effectId: line.range.effectId, value: line.value })),
    // specs/067: a malus turned positive by forgemagie counts like an exo.
    ...flippedLines.map((line) => ({ effectId: line.range.effectId, value: line.value, exo: true })),
  ];
  const negativeInputs = negativeLines.filter((line) => !line.flipped).map((line) => ({ effectId: line.range.effectId, value: line.value }));
  // specs/066: the runes offered as exo are those of the stats the item does not have; each one is taken once.
  const exoRunes: ExoRuneChoice[] = BRISAGE_STATS.flatMap((stat) => {
    const found = [...ranges, ...negativeRanges].some((range) => range.effectId === stat.effectId) ? undefined : runeForStat(RUNES, stat.effectId, SETTINGS.runeSize);
    return found ? [{ effectId: stat.effectId, label: stat.label, runeName: found.rune.name, imageUrl: found.rune.imageUrl, max: lineValueLimit(stat.effectId, SETTINGS) }] : [];
  });
  const analysis = ready && coefficient > 0
    ? analyzeBrisage({ level: item.level ?? NaN, lines: lineInputs, negatives: negativeInputs, coefficient, itemCostKamas: cost }, RUNES, prices, SETTINGS)
    : undefined;
  // specs/063: without a coefficient the table and a focus advice are still shown (normal breaking at 100 %).
  const advice = ready && !(coefficient > 0)
    ? analyzeFocusAdvice({ level: item.level ?? NaN, lines: lineInputs, negatives: negativeInputs, itemCostKamas: Number.isFinite(cost) ? cost : undefined }, RUNES, prices, SETTINGS)
    : undefined;
  const adviceOk = advice?.status === 'ok' ? advice : undefined;
  const ok = analysis?.status === 'ok' ? analysis : undefined;
  const best = ok?.best;
  const normal = ok ? ok.options.find((option) => option.kind === 'normal') : adviceOk?.reference;
  const focusOptions = ok ? ok.options.filter((option) => option.kind === 'focus') : adviceOk?.focusOptions ?? [];
  const bestFocus = ok ? focusOptions.find((option) => option.gainKamas !== undefined) : adviceOk?.bestFocus;
  // A focus is only worth showing when it pays more than breaking normally (FR-013).
  const focusWins = best?.kind === 'focus' && best.gainKamas! >= 0;
  const noCoefficient = adviceOk !== undefined;
  const costKnown = Number.isFinite(cost);
  // The line with the best focus is always marked, even when breaking without focus pays more or the item is a loss.
  const highlightedEffectId = bestFocus?.focusEffectId;
  const nextGains = ok && normal?.gainKamas !== undefined && coefficient > 0
    ? nextCoefficients(coefficient, 3).map((next) => ({ coefficient: next, gain: (normal.valueKamas * next) / coefficient - cost }))
    : [];

  let verdict: BrisageVerdict = { title: 'Prix manquants', hint: undefined, tone: 'neutral' };
  if (best && best.gainKamas! < 0) verdict = { title: 'Pas rentable', hint: undefined, tone: 'bad' };
  else if (best?.kind === 'normal') verdict = { title: 'Rentable sans focus', hint: 'Le focus ne rapporte pas plus : brisez normalement.', tone: 'good' };
  else if (best) verdict = { title: `Rentable avec un focus ${shortRune(best)}`, hint: undefined, tone: 'good' };

  const invalidReason = analysis?.status === 'invalid' ? analysis.reason : advice?.status === 'invalid' ? advice.reason : undefined;
  // specs/063: the advice shown while the coefficient is unknown.
  // DoFocus model: focus and normal breaking both scale with the coefficient, so the better one does not depend on it.
  const adviceKnown = adviceOk?.bestFocus !== undefined && adviceOk.focusBeatsNormal !== undefined;
  const adviceTitle = !adviceKnown ? 'Prix manquants' : adviceOk.focusBeatsNormal ? `Focus ${shortRune(adviceOk.bestFocus!)}` : 'Brisez sans focus';
  const adviceHint = !adviceKnown
    ? 'Notez les prix des runes pour obtenir un conseil.'
    : adviceOk.focusBeatsNormal ? 'Le focus rapporte plus que le brisage normal.' : 'Aucun focus ne rapporte plus que le brisage normal.';
  const breakEvenValue = adviceKnown ? (adviceOk.focusBeatsNormal ? adviceOk.focusBreakEven : adviceOk.normalBreakEven) : undefined;
  const adviceBreakEven = breakEvenValue !== undefined && breakEvenValue > 0 ? breakEvenValue : undefined;

  return {
    offeredExo, exoRunes, analysis, advice, adviceOk, ok, best, normal, focusOptions, bestFocus, focusWins,
    noCoefficient, costKnown, highlightedEffectId, nextGains, verdict, invalidReason,
    adviceKnown, adviceTitle, adviceHint, adviceBreakEven,
  };
}

export type BrisageAnalysis = ReturnType<typeof analyseBrisageItem>;
