import { averageRoll, brisageStat, lineValueLimit, runeForStat } from '../../domain/brisage';
import { mergeRanges, parse, RUNES, SETTINGS, type Range } from './brisageHelpers';

/** The lines of the table worked out from the ranges of the item and the rolls typed on them. */
export function buildBrisageLines(ranges: Range[], negativeRanges: Range[], rolls: Record<number, string>) {
  // Only the lines that break into a known rune are shown; the others are just counted.
  const breakable = mergeRanges(ranges.filter((range) => brisageStat(range.effectId) && runeForStat(RUNES, range.effectId, SETTINGS.runeSize)));
  const lines = breakable.map((range, index) => {
    const average = averageRoll(range.from, range.to);
    // A line with a single value (PO, Ga PA, Ga PM…) can still be typed over; only the Min / Max switch skips it.
    const fixed = range.from === range.to;
    const parsed = parse(rolls[index] ?? '');
    const typed = Number.isFinite(parsed) ? parsed : NaN;
    // specs/066: a roll above the line's maximum is an over, allowed up to the weight limit (or the natural maximum).
    const limit = lineValueLimit(range.effectId, SETTINGS, range.to);
    const tooHigh = typed > limit;
    const invalid = parsed < 0 || parsed === Infinity || tooHigh;
    const usable = typed >= 0 && !tooHigh;
    const modified = usable && typed !== average;
    const over = usable && typed > range.to;
    return { index, range, average, fixed, value: usable ? typed : average, modified, invalid, tooHigh, over, limit };
  });
  // specs/067: a malus is listed after the positive lines (its roll index follows theirs). Its roll is a negative number
  // inside its own range (it gives no rune), or a whole positive number up to the weight limit when forgemagie turned
  // the line positive: then it counts as an exo. Anything else is refused and the average is used.
  const negativeLines = negativeRanges
    .filter((range) => brisageStat(range.effectId) && runeForStat(RUNES, range.effectId, SETTINGS.runeSize))
    .map((range, position) => {
      const index = breakable.length + position;
      const average = averageRoll(range.from, range.to);
      const parsed = parse(rolls[index] ?? '');
      const limit = lineValueLimit(range.effectId, SETTINGS);
      const inRange = Number.isFinite(parsed) && parsed >= range.from && parsed <= range.to;
      const flipped = Number.isInteger(parsed) && parsed >= 1 && parsed <= limit;
      const usable = inRange || flipped;
      return {
        index, range, average, limit, fixed: range.from === range.to, value: usable ? parsed : average,
        modified: usable && parsed !== average, flipped, tooHigh: parsed > limit,
        invalid: Number.isFinite(parsed) && !usable,
      };
    });
  const flippedLines = negativeLines.filter((line) => line.flipped);
  // The Min / Moyen / Max switch of the Jet column: which one all the free lines are set to, if any.
  const freeLines = [...lines, ...negativeLines].filter((line) => !line.fixed);
  const rollMode: 'min' | 'average' | 'max' | undefined = freeLines.length === 0 ? undefined
    : freeLines.every((line) => (rolls[line.index] ?? '') === '') ? 'average'
      : freeLines.every((line) => parse(rolls[line.index] ?? '') === line.range.from) ? 'min'
        : freeLines.every((line) => parse(rolls[line.index] ?? '') === line.range.to) ? 'max'
          : undefined;
  const ignoredCount = ranges.length - ranges.filter((range) => brisageStat(range.effectId) && runeForStat(RUNES, range.effectId, SETTINGS.runeSize)).length
    + negativeRanges.length - negativeLines.length;
  return { lines, negativeLines, flippedLines, freeLines, rollMode, ignoredCount };
}

export type BrisageLines = ReturnType<typeof buildBrisageLines>;
export type BrisageLine = BrisageLines['lines'][number];
export type BrisageNegativeLine = BrisageLines['negativeLines'][number];
