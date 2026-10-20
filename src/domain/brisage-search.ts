import { averageRoll, brisageStat, BRISAGE_STATS, lineWeight, runeForStat, runesForLine, wholeRunes } from './brisage';
import type { BrisageSettings, BrisageStat } from './brisage';
import type { RuneItem } from './forgemagie';

// specs/064-recherche-objets-par-stats: which items to break to get the runes of chosen stats. The estimate is the
// normal breaking of specs/060 at a reference coefficient of 100 %, from the average roll — an ESTIMATE, never a result.

/** DofusDB's « chasse » stat (696969, left out by DoFocus) and the hunting weapon effect (795): not stats to target. */
export const HUNT_EFFECT_IDS = [696969, 795];

export type IndexedEffect = { effectId: number; from: number; to: number };
export type IndexedItem = { id: string; name: string; level: number; imageUrl?: string; effects: IndexedEffect[] };

export type SearchSort = 'runes' | 'kamas' | 'maxRoll';

export type LevelRange = { minLevel?: number; maxLevel?: number };

export type StatEstimate = { effectId: number; from: number; to: number; runes: number; runeId: string };

export type SearchResult = {
  item: IndexedItem;
  perStat: StatEstimate[];
  totalRunes: number;
  /** Value of the estimated runes; absent as soon as one targeted rune has no price. */
  valueKamas?: number;
  /** Highest roll among the targeted stats. */
  maxRoll: number;
};

/** The stats one can target: a known stat with a rune, never the hunt stat. */
export function targetableStats(runes: RuneItem[], size: BrisageSettings['runeSize'] = 'ba'): BrisageStat[] {
  return BRISAGE_STATS.filter((stat) => !HUNT_EFFECT_IDS.includes(stat.effectId) && runeForStat(runes, stat.effectId, size) !== undefined);
}

/** A message when the level range cannot hold any item, else undefined. */
export function levelRangeError({ minLevel, maxLevel }: LevelRange): string | undefined {
  if (minLevel !== undefined && maxLevel !== undefined && minLevel > maxLevel) {
    return 'Le niveau minimum doit être inférieur ou égal au niveau maximum.';
  }
  return undefined;
}

/** The roll of an item on a stat, lines of the same stat added up; undefined when it has no positive roll on it. */
function rollOf(item: IndexedItem, effectId: number): { from: number; to: number } | undefined {
  let from = 0;
  let to = 0;
  let found = false;
  for (const effect of item.effects) {
    if (effect.effectId !== effectId || !(Math.max(effect.from, effect.to) > 0)) continue;
    found = true;
    from += Math.min(effect.from, effect.to);
    to += Math.max(effect.from, effect.to);
  }
  return found ? { from, to } : undefined;
}

/** The items with a positive roll on EVERY chosen stat and a level in the range; none when no stat is chosen. */
export function searchItemsByStats(items: IndexedItem[], effectIds: number[], range: LevelRange = {}): IndexedItem[] {
  const wanted = [...new Set(effectIds)].filter((id) => !HUNT_EFFECT_IDS.includes(id));
  if (wanted.length === 0 || levelRangeError(range)) return [];
  return items.filter((item) =>
    (range.minLevel === undefined || item.level >= range.minLevel) &&
    (range.maxLevel === undefined || item.level <= range.maxLevel) &&
    wanted.every((effectId) => rollOf(item, effectId) !== undefined));
}

/** Runes of each chosen stat given by breaking the item normally at 100 %, from the average roll, whole runes. */
export function estimateTargetRunes(
  item: IndexedItem,
  effectIds: number[],
  runes: RuneItem[],
  settings: BrisageSettings,
  prices: Record<string, number | undefined> = {},
): SearchResult | undefined {
  const perStat: StatEstimate[] = [];
  let value = 0;
  let priced = true;
  let maxRoll = 0;
  for (const effectId of new Set(effectIds)) {
    const roll = rollOf(item, effectId);
    const setting = settings.stats[effectId] ?? brisageStat(effectId);
    const found = runeForStat(runes, effectId, settings.runeSize);
    if (!roll || !setting || !found) return undefined;
    const runeWeight = setting.weight * setting.runePoints * settings.sizeMultipliers[found.size];
    const count = wholeRunes(runesForLine(lineWeight(averageRoll(roll.from, roll.to), setting.weight, item.level, settings), 1, runeWeight));
    perStat.push({ effectId, from: roll.from, to: roll.to, runes: count, runeId: found.rune.id });
    maxRoll = Math.max(maxRoll, roll.to);
    const unit = prices[found.rune.id];
    if (typeof unit === 'number' && unit > 0) value += count * unit;
    else priced = false;
  }
  return {
    item, perStat, maxRoll,
    totalRunes: perStat.reduce((sum, stat) => sum + stat.runes, 0),
    valueKamas: priced ? value : undefined,
  };
}

/** Best first. Ties break on name then id, so the order is stable; an unknown value comes last, never as 0. */
export function sortSearchResults(results: SearchResult[], sort: SearchSort): SearchResult[] {
  const key = (result: SearchResult): number | undefined =>
    sort === 'runes' ? result.totalRunes : sort === 'kamas' ? result.valueKamas : result.maxRoll;
  return [...results].sort((a, b) => {
    const left = key(a);
    const right = key(b);
    if (left === undefined && right !== undefined) return 1;
    if (left !== undefined && right === undefined) return -1;
    if (left !== undefined && right !== undefined && left !== right) return right - left;
    if (sort === 'runes' && a.item.level !== b.item.level) return b.item.level - a.item.level;
    return a.item.name.localeCompare(b.item.name, 'fr') || Number(a.item.id) - Number(b.item.id);
  });
}

/** Search, estimate and sort in one go: what the panel shows. */
export function searchResults(
  items: IndexedItem[],
  effectIds: number[],
  range: LevelRange,
  runes: RuneItem[],
  settings: BrisageSettings,
  prices: Record<string, number | undefined>,
  sort: SearchSort,
): SearchResult[] {
  const results = searchItemsByStats(items, effectIds, range)
    .map((item) => estimateTargetRunes(item, effectIds, runes, settings, prices))
    .filter((result): result is SearchResult => result !== undefined);
  return sortSearchResults(results, sort);
}
