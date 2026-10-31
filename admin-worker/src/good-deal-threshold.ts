import { MAX_THRESHOLD, MIN_THRESHOLD } from '../../src/domain/good-deals';
import { GOOD_DEAL_THRESHOLD_KEY, readGoodDealThreshold } from '../../worker/src/listings';

// specs/078-bons-plans-hdv (contracts/bons-plans-api.md « Réglage du seuil »): the percentage from which an
// HDV announcement is a good deal. Written only through the Access-protected API (src/index.ts).
type Bound = {
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
};
export type ThresholdDb = { prepare(sql: string): { bind(...values: unknown[]): Bound } };

export type ThresholdValidation = { ok: true; value: number } | { ok: false; field: 'thresholdPercent'; error: string };

const INVALID = `Valeur attendue : un nombre entier de ${MIN_THRESHOLD} à ${MAX_THRESHOLD}.`;

export function validateThreshold(input: unknown): ThresholdValidation {
  const value = typeof input === 'object' && input !== null ? (input as Record<string, unknown>).thresholdPercent : undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < MIN_THRESHOLD || value > MAX_THRESHOLD) {
    return { ok: false, field: 'thresholdPercent', error: INVALID };
  }
  return { ok: true, value };
}

export async function getThreshold(db: ThresholdDb): Promise<{ thresholdPercent: number }> {
  return { thresholdPercent: await readGoodDealThreshold(db) };
}

/** Writes the threshold and answers with what is saved, read back, like the page settings. */
export async function saveThreshold(db: ThresholdDb, value: number, now: Date = new Date()): Promise<{ thresholdPercent: number }> {
  await db.prepare(
    `INSERT INTO numeric_settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).bind(GOOD_DEAL_THRESHOLD_KEY, value, now.toISOString()).run();
  return getThreshold(db);
}
