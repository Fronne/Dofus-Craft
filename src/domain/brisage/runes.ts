import type { RuneItem } from '../forgemagie';
import type { BrisageSettings, RuneSize } from './stats';

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

/**
 * specs/067 – DofusDB gives each malus its own effect id (« -Force » is 157, not a negative 118). This table gives, for
 * a malus effect id, the id of the stat it takes away, i.e. the id of BRISAGE_STATS. Read from the DofusDB effects
 * (« -#1 Force » and so on) and checked on the malus that really occur on items.
 */
const NEGATIVE_EFFECT_STAT: Record<number, number> = {
  116: 117, 145: 112, 152: 123, 153: 125, 154: 119, 155: 126, 156: 124, 157: 118, 159: 158, 162: 160, 163: 161,
  168: 111, 169: 128, 171: 115, 175: 174, 177: 176, 179: 178, 186: 138,
  215: 210, 216: 211, 217: 212, 218: 213, 219: 214,
  245: 240, 246: 241, 247: 242, 248: 243, 249: 244,
  411: 410, 413: 412, 415: 414, 417: 416, 419: 418, 421: 420, 423: 422, 425: 424, 427: 426, 429: 428, 431: 430,
  754: 752, 755: 753, 2801: 2800, 2802: 2803, 2805: 2804, 2806: 2807, 2809: 2808, 2813: 2812, 2990: 182,
};

/** The stat a malus effect takes away (its BRISAGE_STATS id); an id that is not a known malus is returned as it is. */
export function negativeStatId(effectId: number): number {
  return NEGATIVE_EFFECT_STAT[effectId] ?? effectId;
}

/**
 * specs/067 – weight of a negative line (a malus): the same formula as a positive line applied to the negative roll,
 * never below 0 (Kama Master, kamamaster.fr: a negative result is brought back to 0). An ESTIMATE: it gives no rune
 * and is never a focus target; in a focus it only adds to the weight put on the focused rune.
 */
export function negativeLineWeight(value: number, statWeight: number, level: number, settings: Pick<BrisageSettings, 'levelFactor' | 'lineBonus'>): number {
  return Math.max(0, lineWeight(value, statWeight, level, settings));
}

/** H2 – runes given by a line of weight `weight` when `share` of it is kept, for a rune weighing `runeWeight`. */
export function runesForLine(weight: number, share: number, runeWeight: number): number {
  return runeWeight > 0 ? (weight * share) / runeWeight : 0;
}
