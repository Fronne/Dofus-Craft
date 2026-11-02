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
