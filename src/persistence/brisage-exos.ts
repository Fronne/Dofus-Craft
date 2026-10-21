import { brisageStat, defaultBrisageSettings, lineValueLimit } from '../domain/brisage';

// specs/066-exo-brisage: the exos the player put on an item (a stat the item does not have by default), kept per
// server and per item on the device so a reload, or a visit to another item and back, brings them back.
const STORAGE_KEY = 'craftcheck-brisage-exos';

export type ExoLine = { effectId: number; value: number };

const keyOf = (serverId: string, itemId: string) => `${serverId}:${itemId}`;

/** Keeps the entries that are a known stat with a whole value from 1 up to the weight limit; drops the rest. */
function validExos(value: unknown): ExoLine[] {
  if (!Array.isArray(value)) return [];
  const settings = defaultBrisageSettings();
  const seen = new Set<number>();
  const exos: ExoLine[] = [];
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { effectId, value: amount } = entry as Record<string, unknown>;
    if (typeof effectId !== 'number' || typeof amount !== 'number' || !Number.isInteger(effectId) || !Number.isInteger(amount)) continue;
    if (!brisageStat(effectId) || seen.has(effectId)) continue;
    if (amount < 1 || amount > lineValueLimit(effectId, settings)) continue;
    seen.add(effectId);
    exos.push({ effectId, value: amount });
  }
  return exos;
}

function readTable(): Record<string, unknown> {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = stored === null ? undefined : JSON.parse(stored);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export function getBrisageExos(serverId: string, itemId: string): ExoLine[] {
  return validExos(readTable()[keyOf(serverId, itemId)]);
}

/** An empty list forgets the entry. */
export function setBrisageExos(serverId: string, itemId: string, exos: ExoLine[]): void {
  try {
    const table = readTable();
    if (exos.length > 0) table[keyOf(serverId, itemId)] = exos;
    else delete table[keyOf(serverId, itemId)];
    if (Object.keys(table).length > 0) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(table));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private browsing or blocked storage: the exos just aren't remembered.
  }
}
