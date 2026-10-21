import type { RuneItem } from './forgemagie';

// specs/060-page-brisage: is breaking an item profitable, and is a focus worth it? Every formula
// here is an ESTIMATE, not an official rule (spec.md H1–H4); the weights and yields are settings.

/**
 * H1 – the coefficient left after one breaking (Dorel's empirical formula, measured on level 40 items).
 * It is a decimal: the game shows the whole part, so several breaks in a row can show the same value
 * (66 %, 66 %, 65 % was read in game, the loss at 66 % being about 0.11 point).
 */
export function nextCoefficient(coefficient: number): number {
  const loss = (2.63e-5 - 5.958e-10 * coefficient) * coefficient * coefficient;
  return Math.max(0, coefficient - loss);
}

/** The coefficient as the game shows it (whole number, nearest). */
export function displayedCoefficient(coefficient: number): number {
  return Math.round(coefficient);
}

/** A rune count as the game gives it: whole runes only. */
export function wholeRunes(count: number): number {
  return Math.round(count);
}

/** specs/061 (FR-006) – the default roll of a line: the middle of its range, rounded down (1–50 → 25, 5–10 → 7). */
export function averageRoll(from: number, to: number): number {
  return Math.floor((Math.min(from, to) + Math.max(from, to)) / 2);
}

// The loss per breaking is small and shrinks with the coefficient, so a long descent has many steps.
const MAX_DESCENT_STEPS = 20000;
/** A coefficient read in game can go above 100 % (a fresh item, a bonus): only an absurd value is refused. */
export const MAX_COEFFICIENT = 4000;

/**
 * The coefficients at which successive items are broken, from `start` while they stay at or above
 * `threshold`. Its length is the number of items worth breaking.
 */
export function coefficientDescent(start: number, threshold: number): number[] {
  const coefficients: number[] = [];
  let current = start;
  while (current >= threshold && current > 0 && coefficients.length < MAX_DESCENT_STEPS) {
    coefficients.push(current);
    current = nextCoefficient(current);
  }
  return coefficients;
}

/** Lowest coefficient at which breaking still pays: the coefficient where runes' value equals the cost. */
export function minimumProfitableCoefficient(coefficient: number, itemCostKamas: number, runesValueKamas: number): number | undefined {
  if (!(runesValueKamas > 0)) return undefined;
  return (coefficient * itemCostKamas) / runesValueKamas;
}

// --- Stats and runes ---

export type RuneSize = 'ba' | 'pa' | 'ra';

export type BrisageStat = {
  /** DofusDB effect id; the same id as the effect of the rune of that stat in rune-items.json. */
  effectId: number;
  label: string;
  /** Weight of one point of the stat. */
  weight: number;
  /** Points of the stat given by the simple (Ba) rune. */
  runePoints: number;
  /** True when the weight matches a real reading or the brisage tables of DoFocus (dofocus.fr/guide) and Dofus pour les Noobs (guide-forgemagie); the others are community values to confirm. */
  confirmed: boolean;
};

const stat = (effectId: number, label: string, weight: number, runePoints = 1, confirmed = false): BrisageStat =>
  ({ effectId, label, weight, runePoints, confirmed });

export const BRISAGE_STATS: BrisageStat[] = [
  stat(125, 'Vitalité', 0.2, 5, true),
  stat(126, 'Intelligence', 1, 1, true),
  stat(118, 'Force', 1, 1, true),
  stat(119, 'Agilité', 1, 1, true),
  stat(123, 'Chance', 1, 1, true),
  stat(124, 'Sagesse', 3, 1, true),
  stat(176, 'Prospection', 3, 1, true),
  stat(138, 'Puissance', 2, 1, true),
  stat(112, 'Dommages', 20, 1, true),
  stat(111, 'PA', 100, 1, true),
  stat(128, 'PM', 90, 1, true),
  stat(117, 'Portée', 51, 1, true),
  stat(182, 'Invocations', 30, 1, true),
  stat(178, 'Soins', 10, 1, true),
  stat(115, 'Critique (%)', 10, 1, true),
  stat(174, 'Initiative', 0.1, 10, true),
  stat(158, 'Pods', 0.25, 10, true),
  stat(226, 'Puissance Pièges', 2, 1, true),
  stat(225, 'Dommages Pièges', 5, 1, true),
  stat(220, 'Dommages Renvoyés', 5, 1, true),
  stat(414, 'Dommages Poussée', 5, 1, true),
  stat(416, 'Résistances Poussée', 2, 1, true),
  stat(418, 'Dommages Critiques', 5, 1, true),
  stat(420, 'Résistances Critiques', 2, 1, true),
  stat(422, 'Dommages Terre', 5, 1, true),
  stat(424, 'Dommages Feu', 5, 1, true),
  stat(426, 'Dommages Eau', 5, 1, true),
  stat(428, 'Dommages Air', 5, 1, true),
  stat(430, 'Dommages Neutre', 5, 1, true),
  stat(240, 'Résistances Terre', 2, 1, true),
  stat(241, 'Résistances Eau', 2, 1, true),
  stat(242, 'Résistances Air', 2, 1, true),
  stat(243, 'Résistances Feu', 2, 1, true),
  stat(244, 'Résistances Neutre', 2, 1, true),
  stat(210, 'Résistance Terre (%)', 6, 1, true),
  stat(211, 'Résistance Eau (%)', 6, 1, true),
  stat(212, 'Résistance Air (%)', 6, 1, true),
  stat(213, 'Résistance Feu (%)', 6, 1, true),
  stat(214, 'Résistance Neutre (%)', 6, 1, true),
  stat(2800, 'Dommages mêlée (%)', 15, 1, true),
  stat(2804, 'Dommages distance (%)', 15, 1, true),
  stat(2808, "Dommages d'armes (%)", 15, 1, true),
  stat(2812, 'Dommages aux sorts (%)', 15, 1, true),
  stat(2803, 'Résistance mêlée (%)', 15, 1, true),
  stat(2807, 'Résistance distance (%)', 15, 1, true),
  stat(160, 'Esquive PA', 7, 1, true),
  stat(161, 'Esquive PM', 7, 1, true),
  stat(410, 'Retrait PA', 7, 1, true),
  stat(412, 'Retrait PM', 7, 1, true),
  stat(752, 'Fuite', 4, 1, true),
  stat(753, 'Tacle', 4, 1, true),
  stat(795, 'Arme de chasse', 5, 1, true),
];

export type BrisageSettings = {
  /** H2 – 0.015 × level × value × stat weight. */
  levelFactor: number;
  /** H2 – the +1 added to every line. */
  lineBonus: number;
  /** H3 – share of the focused line's weight that is kept (100 %). */
  focusTargetShare: number;
  /** H3 – share of the other lines' weight that goes into the focused rune (50 %); those lines give no rune. */
  focusOtherShare: number;
  /** Weight of a Ba / Pa / Ra rune relative to the simple rune. */
  sizeMultipliers: Record<RuneSize, number>;
  /** The rune size the lines are turned into and priced with. */
  runeSize: RuneSize;
  /** Per effect id, the weight per point and the points of the Ba rune. */
  stats: Record<number, { weight: number; runePoints: number }>;
};

export function defaultBrisageSettings(): BrisageSettings {
  return {
    levelFactor: 0.015,
    lineBonus: 1,
    focusTargetShare: 1,
    focusOtherShare: 0.5,
    sizeMultipliers: { ba: 1, pa: 3, ra: 10 },
    runeSize: 'ba',
    stats: Object.fromEntries(BRISAGE_STATS.map((s) => [s.effectId, { weight: s.weight, runePoints: s.runePoints }])),
  };
}

export function brisageStat(effectId: number): BrisageStat | undefined {
  return BRISAGE_STATS.find((s) => s.effectId === effectId);
}

/** Fills a partial object read from storage with the defaults; wrong-typed fields are dropped. */
export function mergeBrisageSettings(value: unknown): BrisageSettings {
  const defaults = defaultBrisageSettings();
  if (typeof value !== 'object' || value === null) return defaults;
  const raw = value as Record<string, unknown>;
  const positive = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback);
  const sizes = typeof raw.sizeMultipliers === 'object' && raw.sizeMultipliers !== null ? raw.sizeMultipliers as Record<string, unknown> : {};
  const stats = typeof raw.stats === 'object' && raw.stats !== null ? raw.stats as Record<string, unknown> : {};
  const mergedStats = { ...defaults.stats };
  for (const [key, entry] of Object.entries(stats)) {
    const id = Number(key);
    if (!(id in mergedStats) || typeof entry !== 'object' || entry === null) continue;
    const e = entry as Record<string, unknown>;
    mergedStats[id] = { weight: positive(e.weight, mergedStats[id].weight), runePoints: positive(e.runePoints, mergedStats[id].runePoints) };
  }
  return {
    levelFactor: positive(raw.levelFactor, defaults.levelFactor),
    lineBonus: positive(raw.lineBonus, defaults.lineBonus),
    focusTargetShare: Math.min(1, positive(raw.focusTargetShare, defaults.focusTargetShare)),
    focusOtherShare: Math.min(1, positive(raw.focusOtherShare, defaults.focusOtherShare)),
    sizeMultipliers: {
      ba: positive(sizes.ba, defaults.sizeMultipliers.ba),
      pa: positive(sizes.pa, defaults.sizeMultipliers.pa),
      ra: positive(sizes.ra, defaults.sizeMultipliers.ra),
    },
    runeSize: raw.runeSize === 'pa' || raw.runeSize === 'ra' ? raw.runeSize : 'ba',
    stats: mergedStats,
  };
}

/** The size of a rune, read from its name (« Rune Pa Fo », « Rune Ra Fo »); anything else is a simple rune. */
export function runeSizeOf(rune: RuneItem): RuneSize {
  if (rune.name.startsWith('Rune Pa ')) return 'pa';
  if (rune.name.startsWith('Rune Ra ')) return 'ra';
  return 'ba';
}

/** The rune of a stat in the wanted size, else the closest smaller one, else the first one the stat has. */
export function runeForStat(runes: RuneItem[], effectId: number, size: RuneSize): { rune: RuneItem; size: RuneSize } | undefined {
  const own = runes.filter((rune) => rune.effectId === effectId);
  const order: RuneSize[] = size === 'ra' ? ['ra', 'pa', 'ba'] : size === 'pa' ? ['pa', 'ba'] : ['ba'];
  for (const wanted of order) {
    const found = own.find((rune) => runeSizeOf(rune) === wanted);
    if (found) return { rune: found, size: wanted };
  }
  const first = own[0];
  return first ? { rune: first, size: runeSizeOf(first) } : undefined;
}

/** H2 – weight of a line of `value` points of a stat on an item of `level`. */
export function lineWeight(value: number, statWeight: number, level: number, settings: Pick<BrisageSettings, 'levelFactor' | 'lineBonus'>): number {
  return value * statWeight * level * settings.levelFactor + settings.lineBonus;
}

/** H2 – runes given by a line of weight `weight` when `share` of it is kept, for a rune weighing `runeWeight`. */
export function runesForLine(weight: number, share: number, runeWeight: number): number {
  return runeWeight > 0 ? (weight * share) / runeWeight : 0;
}

// --- Weight limit (specs/066) ---

/** An exo, and an over (a roll above the line's maximum), cannot weigh more than this. */
export const MAX_LINE_WEIGHT = 101;

/** The biggest whole value a line of that stat weight can have under MAX_LINE_WEIGHT (0 without a usable weight). */
export function maxValueForWeight(weight: number): number {
  return weight > 0 ? Math.floor(MAX_LINE_WEIGHT / weight + 1e-9) : 0;
}

/**
 * The biggest value a line of `effectId` accepts: for an exo, what the weight limit allows; for a line the item
 * already has (an over), that or the line's own natural maximum when it is higher — a roll the item can have
 * naturally is never refused.
 */
export function lineValueLimit(effectId: number, settings: Pick<BrisageSettings, 'stats'>, naturalMax?: number): number {
  const weight = (settings.stats[effectId] ?? brisageStat(effectId))?.weight ?? 0;
  return Math.max(maxValueForWeight(weight), naturalMax ?? 0);
}

/** Whether `value` fits `limit`: a whole number from 1 for an exo, any number from 0 for an over. */
export function isRollAllowed(value: number, limit: number, options: { exo?: boolean } = {}): boolean {
  if (!Number.isFinite(value) || value > limit) return false;
  return options.exo ? Number.isInteger(value) && value >= 1 : value >= 0;
}

// --- Analysis ---

/** specs/066: `exo` marks a line the item does not have by default; it counts like any line but is never a focus target. */
export type BrisageLine = { effectId: number; value: number; exo?: boolean };

export type BrisageInput = {
  level: number;
  lines: BrisageLine[];
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
function usableLines(lines: BrisageLine[], runes: RuneItem[], settings: BrisageSettings) {
  const merged = new Map<number, BrisageLine>();
  const ignored: number[] = [];
  for (const line of lines) {
    if (!(line.value > 0)) continue;
    if (!statSetting(settings, line.effectId) || !runeForStat(runes, line.effectId, settings.runeSize)) {
      if (!ignored.includes(line.effectId)) ignored.push(line.effectId);
      continue;
    }
    const known = merged.get(line.effectId);
    merged.set(line.effectId, { effectId: line.effectId, value: (known?.value ?? 0) + line.value, exo: known?.exo || line.exo || undefined });
  }
  return { lines: [...merged.values()], ignored };
}

function buildOption(
  kind: BrisageOption['kind'],
  focusEffectId: number | undefined,
  lines: BrisageLine[],
  /** Share of the coefficient that applies (1 = 100 %). */
  scale: number,
  input: BrisageInput,
  runes: RuneItem[],
  prices: Record<string, number | undefined>,
  settings: BrisageSettings,
): BrisageOption {
  const yields: RuneYield[] = [];
  const missing: string[] = [];
  let value = 0;
  // DoFocus model (docs/dofocus-brisage.md): a focus puts the target's whole weight plus a share of the other lines' weight
  // into the target rune; the other lines give nothing. Everything is scaled by the coefficient.
  const weightOf = (line: BrisageLine) => lineWeight(line.value, statSetting(settings, line.effectId)!.weight, input.level, settings);
  const focusWeight = focusEffectId === undefined ? 0 : lines.reduce(
    (sum, line) => sum + weightOf(line) * (line.effectId === focusEffectId ? settings.focusTargetShare : settings.focusOtherShare), 0,
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
  const focuses = lines.filter((line) => !line.exo).map((line) => buildOption('focus', line.effectId, lines, scale, input, runes, prices, settings));
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

// specs/063-brisage-sans-coefficient, corrected by the DoFocus focus model (docs/dofocus-brisage.md): advice when the coefficient is unknown.
// Normal breaking and focus are both proportional to the coefficient, so which of the two pays more does
// not depend on it. The price of the item only moves the coefficient below which breaking stops paying.

export type FocusAdviceInput = { level: number; lines: BrisageLine[]; itemCostKamas?: number };

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
  const focusOptions = lines.filter((line) => !line.exo).map((line) => buildOption('focus', line.effectId, lines, 1, base, runes, prices, settings));
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
