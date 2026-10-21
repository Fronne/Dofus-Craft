import { getOrCreateDeviceId } from '../persistence/community-device-id';

// specs/069-coefficients-brisage-partages: the breaking coefficients shared between players (Worker route
// /brisage-coefficients). Nothing here throws: a Worker that doesn't answer gives `undefined` / `false`, and the
// page keeps what is on the device.

const API_URL = import.meta.env.VITE_COMMUNITY_API_URL;
const API_KEY = import.meta.env.VITE_COMMUNITY_API_KEY;
/** The Worker refuses more than this many items per read. */
export const MAX_ITEMS_PER_READ = 98;
/** The Worker refuses more than this many notes per send. */
export const MAX_ENTRIES_PER_SEND = 100;

export type SharedCoefficient = { coefficient: number; savedAt: string };
export type CoefficientToSend = { serverId: string; itemId: string; coefficient: number; savedAt?: string };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** The latest shared coefficient of each item that has one; `undefined` when the answer is unusable. */
export async function getSharedCoefficients(serverId: string, itemIds: string[]): Promise<Map<string, SharedCoefficient> | undefined> {
  const ids = [...new Set(itemIds)].slice(0, MAX_ITEMS_PER_READ);
  if (ids.length === 0) return new Map();
  let payload: unknown;
  try {
    const params = new URLSearchParams({ serverId, itemIds: ids.join(',') });
    const response = await fetch(`${API_URL}/brisage-coefficients?${params.toString()}`, { headers: { Authorization: `Bearer ${API_KEY}` } });
    if (!response.ok) return undefined;
    payload = await response.json();
  } catch {
    return undefined;
  }
  if (!isRecord(payload) || !Array.isArray(payload.coefficients)) return undefined;
  const found = new Map<string, SharedCoefficient>();
  for (const row of payload.coefficients) {
    if (isRecord(row) && typeof row.itemId === 'string' && typeof row.coefficient === 'number' && row.coefficient > 0
      && typeof row.notedAt === 'string' && !Number.isNaN(Date.parse(row.notedAt))) {
      found.set(row.itemId, { coefficient: row.coefficient, savedAt: row.notedAt });
    }
  }
  return found;
}

/** Sends notes (at most MAX_ENTRIES_PER_SEND); `savedAt` keeps the original date of an imported note. True when the Worker stored them. */
export async function submitCoefficients(entries: CoefficientToSend[]): Promise<boolean> {
  if (entries.length === 0) return true;
  try {
    const response = await fetch(`${API_URL}/brisage-coefficients`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: getOrCreateDeviceId(),
        entries: entries.map(({ serverId, itemId, coefficient, savedAt }) => (savedAt ? { serverId, itemId, coefficient, notedAt: savedAt } : { serverId, itemId, coefficient })),
      }),
      // A coefficient noted just before the page unloads is still sent.
      keepalive: true,
    });
    return response.ok;
  } catch {
    return false;
  }
}
