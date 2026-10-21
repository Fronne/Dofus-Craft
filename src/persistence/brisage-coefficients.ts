// specs/061-simplification-page-brisage (FR-004): the last breaking coefficient the player noted for an
// item, with its date, kept on the device (one entry per server and item).
import { MAX_COEFFICIENT } from '../domain/brisage';

const STORAGE_KEY ='craftcheck-brisage-coefficients';

export type StoredCoefficient = { coefficient: number; savedAt: string };

const isValid = (value: unknown): value is StoredCoefficient => {
  if (typeof value !== 'object' || value === null) return false;
  const { coefficient, savedAt } = value as Record<string, unknown>;
  return typeof coefficient === 'number' && coefficient > 0 && coefficient <= MAX_COEFFICIENT
    &&typeof savedAt === 'string' && !Number.isNaN(Date.parse(savedAt));
};

function readAll(): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export function getStoredCoefficient(serverId: string, itemId: string): StoredCoefficient | undefined {
  const entry = readAll()[`${serverId}:${itemId}`];
  return isValid(entry) ? entry : undefined;
}

export function saveCoefficient(serverId: string, itemId: string, coefficient: number): StoredCoefficient | undefined {
  const entry = { coefficient, savedAt: new Date().toISOString() };
  if (!isValid(entry)) return undefined;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readAll(), [`${serverId}:${itemId}`]: entry }));
  } catch {
    // Private browsing or blocked storage: the coefficient just isn't remembered.
  }
  return entry;
}

/** The more recent of two coefficients (the first on a tie), or the one that exists. */
export function latestCoefficient(a: StoredCoefficient | undefined, b: StoredCoefficient | undefined): StoredCoefficient | undefined {
  if (!a || !b) return a ?? b;
  return Date.parse(b.savedAt) > Date.parse(a.savedAt) ? b : a;
}

// specs/069-coefficients-brisage-partages (FR-006, FR-007): the coefficients noted before they were shared are sent
// once to the server, with their original date. Those dated before this instant (21/10/2026 17:30 Paris) are not.
export const IMPORT_NOT_BEFORE = '2026-10-21T15:30:00.000Z';
const IMPORTED_KEY = 'craftcheck-brisage-coefficients-imported';

export type ImportableCoefficient = StoredCoefficient & { serverId: string; itemId: string };

export function hasImportedCoefficients(): boolean {
  try {
    return window.localStorage.getItem(IMPORTED_KEY) === '1';
  } catch {
    return true; // Without storage the flag can't be kept: don't send the same notes at every visit.
  }
}

export function markCoefficientsImported(): void {
  try {
    window.localStorage.setItem(IMPORTED_KEY, '1');
  } catch {
    // Blocked storage: nothing to remember.
  }
}

export function listImportableCoefficients(): ImportableCoefficient[] {
  const limit = Date.parse(IMPORT_NOT_BEFORE);
  const found: ImportableCoefficient[] = [];
  for (const [key, entry] of Object.entries(readAll())) {
    const colon = key.lastIndexOf(':');
    if (colon <= 0 || colon === key.length - 1 || !isValid(entry) || Date.parse(entry.savedAt) < limit) continue;
    found.push({ serverId: key.slice(0, colon), itemId: key.slice(colon + 1), coefficient: entry.coefficient, savedAt: entry.savedAt });
  }
  return found;
}
