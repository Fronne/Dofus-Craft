import {
  analyzeBrisage,
  analyzeFocusAdvice,
  averageRoll,
  BRISAGE_STATS,
  brisageStat,
  runeForStat,
  type BrisageLine,
  type BrisageOption,
  type BrisageSettings,
} from './brisage';
import { HUNT_EFFECT_IDS, levelRangeError, type IndexedItem } from './brisage-search';
import type { RuneItem } from './forgemagie';

// specs/072-classement-brisage: the ranking of the items worth breaking. Every figure comes from the functions of the
// Brisage page (analyzeBrisage with a coefficient, analyzeFocusAdvice without): the ranking only runs them for many
// items, at the average roll of each line. Nothing here is a result — all of it is an ESTIMATE (specs/060).

/** A price, a rune price or a coefficient older than this many days is shown as stale. */
export const STALE_AFTER_DAYS = 7;
/** Under this many days a date is fresh. */
export const FRESH_WITHIN_DAYS = 1;
/** Above this coefficient (%) breaking can never pay: the game does not give more than 100 %. */
export const MAX_USEFUL_COEFFICIENT = 100;

const DAY_MS = 24 * 60 * 60 * 1000;

export type FreshnessLevel = 'fresh' | 'old' | 'stale' | 'unknown';

/** How fresh a date is; `unknown` when it is missing or unreadable. */
export function freshnessOf(date: string | undefined, now: Date = new Date()): FreshnessLevel {
  if (!date) return 'unknown';
  const time = Date.parse(date);
  if (Number.isNaN(time)) return 'unknown';
  const age = now.getTime() - time;
  if (age >= STALE_AFTER_DAYS * DAY_MS) return 'stale';
  return age >= FRESH_WITHIN_DAYS * DAY_MS ? 'old' : 'fresh';
}

/** Age in whole days (0 for today); undefined when the date is missing or unreadable. */
export function ageInDays(date: string | undefined, now: Date = new Date()): number | undefined {
  const time = date ? Date.parse(date) : NaN;
  return Number.isNaN(time) ? undefined : Math.max(0, Math.floor((now.getTime() - time) / DAY_MS));
}

export type RankingGroup = 'known' | 'unknown';
export type RankingStatus = 'ok' | 'missing-rune-price' | 'no-breakable-line' | 'no-price';

export type RankingExo = {
  effectId: number;
  statLabel: string;
  runeName: string;
  /** The one rune of the stat that has to be spent at least to put the exo on the item. */
  runePriceKamas: number;
  /** Known coefficient: the gain with the exo, the price of the rune already taken off. */
  gainKamas?: number;
  improvementKamas?: number;
  /** Unknown coefficient: the threshold with the rune added to the price of the item. */
  thresholdCoefficient?: number;
};

export type RankingRow = {
  itemId: string;
  name: string;
  level: number;
  imageUrl?: string;
  categoryId?: string;
  priceKamas?: number;
  priceUpdatedAt?: string;
  coefficient?: number;
  coefficientAt?: string;
  group: RankingGroup;
  status: RankingStatus;
  best?: { kind: 'normal' | 'focus'; focusEffectId?: number; focusRuneName?: string };
  /** Only for a known coefficient and a complete price list: the gain per item of the best choice. */
  gainKamas?: number;
  /** The coefficient (%) under which the best choice stops paying the item. */
  thresholdCoefficient?: number;
  /** The threshold is above 100 % (or the runes are worth nothing): breaking cannot pay at any coefficient. */
  neverProfitable: boolean;
  exo?: RankingExo;
  /** The oldest date among the prices of the runes the best choice gives. */
  oldestRunePriceAt?: string;
};

export type RankingContext = {
  runes: RuneItem[];
  settings: BrisageSettings;
  runePrices: Record<string, number | undefined>;
  runePriceDates: Record<string, string | undefined>;
  itemPrices: Map<string, { kamas: number; updatedAt?: string }>;
  coefficients: Map<string, { coefficient: number; savedAt: string }>;
};

export type RankingColumn = 'name' | 'level' | 'price' | 'gain' | 'threshold' | 'exoGain';

export type RankingView = {
  sortColumn: RankingColumn;
  sortDirection: 'asc' | 'desc';
  minLevel?: number;
  maxLevel?: number;
  categoryId?: string;
  minGainKamas?: number;
  hideWithoutPrice: boolean;
  hideWithoutCoefficient: boolean;
};

export const DEFAULT_RANKING_VIEW: RankingView = {
  sortColumn: 'gain',
  sortDirection: 'desc',
  hideWithoutPrice: true,
  hideWithoutCoefficient: false,
};

type Range = { effectId: number; from: number; to: number };

/** Two lines of the same stat count as one (the analysis adds them up), as on the Brisage page. */
function mergeRanges(ranges: Range[]): Range[] {
  const merged = new Map<number, Range>();
  for (const range of ranges) {
    const known = merged.get(range.effectId);
    merged.set(range.effectId, known ? { effectId: range.effectId, from: known.from + range.from, to: known.to + range.to } : range);
  }
  return [...merged.values()];
}

/** The lines of an item at their average roll. */
function averageLines(item: IndexedItem): BrisageLine[] {
  return mergeRanges(item.effects.map((effect) => ({ effectId: effect.effectId, from: effect.from, to: effect.to })))
    .map((range) => ({ effectId: range.effectId, value: averageRoll(range.from, range.to) }));
}

const datesOf = (option: BrisageOption | undefined, dates: RankingContext['runePriceDates']): string | undefined => {
  if (!option) return undefined;
  const found = option.yields.filter((y) => y.count > 0).map((y) => dates[y.runeId]).filter((d): d is string => !!d && !Number.isNaN(Date.parse(d)));
  return found.length === 0 ? undefined : found.reduce((oldest, d) => (Date.parse(d) < Date.parse(oldest) ? d : oldest));
};

/** The threshold of the cheaper way of breaking, from a focus advice (unknown coefficient). */
function adviceThreshold(advice: Extract<ReturnType<typeof analyzeFocusAdvice>, { status: 'ok' }>): { threshold?: number; best: NonNullable<RankingRow['best']>; option: BrisageOption } {
  const useFocus = advice.focusBreakEven !== undefined && advice.bestFocus !== undefined
    && (advice.normalBreakEven === undefined || advice.focusBreakEven < advice.normalBreakEven);
  if (useFocus) {
    const focus = advice.bestFocus!;
    return { threshold: advice.focusBreakEven, option: focus, best: { kind: 'focus', focusEffectId: focus.focusEffectId, focusRuneName: focus.focusRuneName } };
  }
  return { threshold: advice.normalBreakEven, option: advice.reference, best: { kind: 'normal' } };
}

/** One row of the ranking for an item of the index. */
export function buildRankingRow(item: IndexedItem, context: RankingContext): RankingRow {
  const price = context.itemPrices.get(item.id);
  const coefficient = context.coefficients.get(item.id);
  const base: RankingRow = {
    itemId: item.id, name: item.name, level: item.level, imageUrl: item.imageUrl, categoryId: item.categoryId,
    priceKamas: price?.kamas, priceUpdatedAt: price?.updatedAt,
    coefficient: coefficient?.coefficient, coefficientAt: coefficient?.savedAt,
    group: coefficient ? 'known' : 'unknown', status: 'no-price', neverProfitable: false,
  };
  if (!price || !(price.kamas > 0)) return base;
  const lines = averageLines(item);

  if (coefficient) {
    const analysis = analyzeBrisage(
      { level: item.level, lines, coefficient: coefficient.coefficient, itemCostKamas: price.kamas },
      context.runes, context.runePrices, context.settings,
    );
    if (analysis.status !== 'ok') return { ...base, status: 'no-breakable-line' };
    const best = analysis.best;
    if (!best) return { ...base, status: 'missing-rune-price' };
    const threshold = best.kind === 'focus' ? analysis.focusThresholdCoefficient : analysis.thresholdCoefficient;
    return {
      ...base, status: 'ok', gainKamas: best.gainKamas, thresholdCoefficient: threshold,
      best: { kind: best.kind, focusEffectId: best.focusEffectId, focusRuneName: best.focusRuneName },
      neverProfitable: false,
      oldestRunePriceAt: datesOf(best, context.runePriceDates),
    };
  }

  const advice = analyzeFocusAdvice({ level: item.level, lines, itemCostKamas: price.kamas }, context.runes, context.runePrices, context.settings);
  if (advice.status !== 'ok') return { ...base, status: 'no-breakable-line' };
  if (advice.reference.missingRuneIds.length > 0) return { ...base, status: 'missing-rune-price' };
  const { threshold, best, option } = adviceThreshold(advice);
  return {
    ...base, status: 'ok', best, thresholdCoefficient: threshold,
    neverProfitable: threshold === undefined || threshold > MAX_USEFUL_COEFFICIENT,
    oldestRunePriceAt: datesOf(option, context.runePriceDates),
  };
}

/** A row for every item of the index, in the order of the index. */
export function buildRanking(items: IndexedItem[], context: RankingContext): RankingRow[] {
  return items.map((item) => buildRankingRow(item, context));
}

/**
 * The best exo for a row: a rune of a stat the item does not have, put on it before breaking. At least one rune of that
 * stat has to be spent, so its price is taken off; the failures and extra runes of the forgemagie are not counted. The
 * exo is only given when it beats breaking the item as it is.
 */
export function bestExoFor(item: IndexedItem, row: RankingRow, context: RankingContext): RankingExo | undefined {
  if (row.status !== 'ok' || row.priceKamas === undefined) return undefined;
  const lines = averageLines(item);
  const have = new Set(item.effects.map((effect) => effect.effectId));
  let best: RankingExo | undefined;
  for (const stat of BRISAGE_STATS) {
    if (have.has(stat.effectId) || HUNT_EFFECT_IDS.includes(stat.effectId)) continue;
    const found = runeForStat(context.runes, stat.effectId, context.settings.runeSize);
    const runePrice = found ? context.runePrices[found.rune.id] : undefined;
    if (!found || typeof runePrice !== 'number' || !(runePrice > 0)) continue;
    const withExo: BrisageLine[] = [...lines, { effectId: stat.effectId, value: 1, exo: true }];
    const candidate: RankingExo = { effectId: stat.effectId, statLabel: stat.label, runeName: found.rune.name, runePriceKamas: runePrice };
    if (row.group === 'known') {
      const analysis = analyzeBrisage(
        { level: item.level, lines: withExo, coefficient: row.coefficient!, itemCostKamas: row.priceKamas },
        context.runes, context.runePrices, context.settings,
      );
      const gain = analysis.status === 'ok' ? analysis.best?.gainKamas : undefined;
      if (gain === undefined) continue;
      candidate.gainKamas = gain - runePrice;
      candidate.improvementKamas = candidate.gainKamas - (row.gainKamas ?? 0);
      if (candidate.improvementKamas > 0 && (!best || candidate.gainKamas > (best.gainKamas ?? -Infinity))) best = candidate;
    } else {
      const advice = analyzeFocusAdvice({ level: item.level, lines: withExo, itemCostKamas: row.priceKamas + runePrice }, context.runes, context.runePrices, context.settings);
      if (advice.status !== 'ok' || advice.reference.missingRuneIds.length > 0) continue;
      const { threshold } = adviceThreshold(advice);
      if (threshold === undefined) continue;
      candidate.thresholdCoefficient = threshold;
      const beatsBase = row.thresholdCoefficient === undefined || threshold < row.thresholdCoefficient;
      if (beatsBase && (!best || threshold < (best.thresholdCoefficient ?? Infinity))) best = candidate;
    }
  }
  return best;
}

/** The value a column sorts on; a bigger value is a better one, and undefined always goes last. */
function sortValue(row: RankingRow, column: RankingColumn): number | string | undefined {
  switch (column) {
    case 'name': return row.name;
    case 'level': return row.level;
    case 'price': return row.priceKamas;
    case 'threshold': return row.thresholdCoefficient;
    case 'gain':
      // Without a coefficient there is no gain: the lower the threshold, the more likely the item pays.
      return row.group === 'known' ? row.gainKamas : row.thresholdCoefficient === undefined ? undefined : -row.thresholdCoefficient;
    case 'exoGain':
      if (row.group === 'known') return row.exo?.gainKamas ?? row.gainKamas;
      return row.exo?.thresholdCoefficient !== undefined ? -row.exo.thresholdCoefficient : sortValue(row, 'gain');
  }
}

/** A row whose figures cannot be trusted or do not exist goes after the others, whatever the direction. */
const goesLast = (row: RankingRow) => row.status !== 'ok';

/** Sorts a copy; the sort is stable, so two equal rows keep their order. */
export function sortRows(rows: RankingRow[], column: RankingColumn, direction: 'asc' | 'desc'): RankingRow[] {
  const sign = direction === 'asc' ? 1 : -1;
  return rows
    .map((row, position) => ({ row, position, value: goesLast(row) ? undefined : sortValue(row, column) }))
    .sort((a, b) => {
      if (a.value === undefined || b.value === undefined) {
        if (a.value === b.value) return a.position - b.position;
        return a.value === undefined ? 1 : -1;
      }
      const order = typeof a.value === 'string' || typeof b.value === 'string'
        ? String(a.value).localeCompare(String(b.value), 'fr')
        : a.value - b.value;
      return order === 0 ? a.position - b.position : order * sign;
    })
    .map((entry) => entry.row);
}

/** The rows the view lets through (the sort is separate). */
export function filterRows(rows: RankingRow[], view: RankingView): RankingRow[] {
  const levelOk = levelRangeError({ minLevel: view.minLevel, maxLevel: view.maxLevel }) === undefined;
  return rows.filter((row) => {
    if (view.hideWithoutPrice && row.status === 'no-price') return false;
    if (view.hideWithoutCoefficient && row.group === 'unknown') return false;
    if (levelOk && view.minLevel !== undefined && row.level < view.minLevel) return false;
    if (levelOk && view.maxLevel !== undefined && row.level > view.maxLevel) return false;
    if (view.categoryId && row.categoryId !== view.categoryId) return false;
    // A gain minimum only means something where there is a gain: the items of a known coefficient.
    if (view.minGainKamas !== undefined && row.group === 'known' && (row.gainKamas === undefined || row.gainKamas < view.minGainKamas)) return false;
    return true;
  });
}

/** The label of a stat for an exo, shared with the table. */
export const statLabelOf = (effectId: number): string => brisageStat(effectId)?.label ?? `Effet ${effectId}`;
