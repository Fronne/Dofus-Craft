import { brisageStat, type BrisageSettings } from './stats';

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
