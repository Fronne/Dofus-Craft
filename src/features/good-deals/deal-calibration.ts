import { IMPORTANCE_LEVELS, MAX_THRESHOLD, MIN_THRESHOLD, type DealCalibration } from '../../domain/good-deals';

// specs/080-bons-plans-filtre-calibrage (FR-013): a player's calibration lives in their browser only. What can't
// be read is left out, value by value, so an old or damaged save falls back on the defaults.

export const CALIBRATION_STORAGE_KEY = 'dofus-craft-deal-calibration';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isImportance = (value: unknown) => IMPORTANCE_LEVELS.some((level) => level.value === value);
const isGap = (value: unknown) => value === null || (typeof value === 'number' && Number.isInteger(value) && value >= 0);

export function isThreshold(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= MIN_THRESHOLD && value <= MAX_THRESHOLD;
}

function kept<T>(value: unknown, isValid: (entry: unknown) => boolean): Record<number, T> | undefined {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value).filter(([key, entry]) => /^\d+$/.test(key) && isValid(entry));
  return entries.length > 0 ? Object.fromEntries(entries) as Record<number, T> : undefined;
}

export function parseCalibration(text: string | null): DealCalibration {
  if (!text) return {};
  try {
    const value: unknown = JSON.parse(text);
    if (!isRecord(value)) return {};
    const calibration: DealCalibration = {};
    const importance = kept<number>(value.importance, isImportance);
    const gaps = kept<number | null>(value.gaps, isGap);
    if (importance) calibration.importance = importance;
    if (gaps) calibration.gaps = gaps;
    if (isThreshold(value.thresholdPercent)) calibration.thresholdPercent = value.thresholdPercent;
    return calibration;
  } catch {
    return {};
  }
}

export function readCalibration(): DealCalibration {
  try {
    return parseCalibration(window.localStorage.getItem(CALIBRATION_STORAGE_KEY));
  } catch {
    return {};
  }
}

// A browser that refuses to store keeps the calibration until the page is reloaded.
export function writeCalibration(calibration: DealCalibration): void {
  try {
    if (Object.keys(calibration).length === 0) window.localStorage.removeItem(CALIBRATION_STORAGE_KEY);
    else window.localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(calibration));
  } catch {
    // Nothing to do: the calibration still applies to this visit.
  }
}
