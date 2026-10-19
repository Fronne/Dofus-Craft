// specs/061-simplification-page-brisage (FR-004): the last breaking coefficient the player noted for an
// item, with its date, kept on the device (one entry per server and item).
const STORAGE_KEY = 'craftcheck-brisage-coefficients';

export type StoredCoefficient = { coefficient: number; savedAt: string };

const isValid = (value: unknown): value is StoredCoefficient => {
  if (typeof value !== 'object' || value === null) return false;
  const { coefficient, savedAt } = value as Record<string, unknown>;
  return typeof coefficient === 'number' && coefficient > 0 && coefficient <= 100
    && typeof savedAt === 'string' && !Number.isNaN(Date.parse(savedAt));
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
