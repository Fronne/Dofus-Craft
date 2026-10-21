import { retentionCutoff } from './retention';

// specs/069-coefficients-brisage-partages: the breaking coefficients noted on the Brisage page, shared by
// all players (table brisage_coefficients). History kept 90 days (the same cutoff as the price contributions).

// Same bound as the page (src/domain/brisage.ts MAX_COEFFICIENT), repeated: the Worker doesn't import the app.
export const MAX_COEFFICIENT = 4000;
export const MAX_ENTRIES_PER_REQUEST = 100;
// D1 allows 100 bound parameters a query; a read binds the items plus 3 more.
export const MAX_ITEMS_PER_READ = 96;
// A device clock a little ahead is tolerated; further ahead the note is refused.
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

export type CoefficientEntry = { serverId: string; itemId: string; coefficient: number; notedAt: string };
export type CoefficientPayload = { deviceId: string; entries: CoefficientEntry[] };

const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 100;

// Returns undefined for anything invalid: one bad entry refuses the request, so a client bug is seen
// rather than silently dropped. `notedAt` defaults to now (a note typed on the page); an import sends the
// original date. A date older than the retention is refused: it would be purged at once.
export function parseCoefficientPayload(body: unknown, now: Date = new Date()): CoefficientPayload | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const { deviceId, entries } = body as Record<string, unknown>;
  if (!isText(deviceId) || !Array.isArray(entries) || entries.length === 0 || entries.length > MAX_ENTRIES_PER_REQUEST) return undefined;
  const oldest = retentionCutoff(now);
  const latest = now.getTime() + FUTURE_TOLERANCE_MS;
  const parsed: CoefficientEntry[] = [];
  for (const entry of entries) {
    if (typeof entry !== 'object' || entry === null) return undefined;
    const { serverId, itemId, coefficient, notedAt } = entry as Record<string, unknown>;
    if (!isText(serverId) || !isText(itemId)) return undefined;
    if (typeof coefficient !== 'number' || !(coefficient > 0 && coefficient <= MAX_COEFFICIENT)) return undefined;
    let when = now.toISOString();
    if (notedAt !== undefined) {
      if (typeof notedAt !== 'string' || Number.isNaN(Date.parse(notedAt))) return undefined;
      when = new Date(notedAt).toISOString();
      if (Date.parse(when) > latest || when < oldest) return undefined;
    }
    parsed.push({ serverId, itemId, coefficient, notedAt: when });
  }
  return { deviceId, entries: parsed };
}

type Bound<S> = S & { all<T>(): Promise<{ results: T[] }> };
type CoefficientDb<S, B> = {
  prepare(sql: string): { bind(...values: unknown[]): Bound<S> & B };
  batch(statements: B[]): Promise<unknown>;
};

// INSERT OR IGNORE on (server, item, date, device): a retried import does not duplicate anything.
export async function insertCoefficients<S, B>(db: CoefficientDb<S, B>, payload: CoefficientPayload): Promise<void> {
  await db.batch(payload.entries.map((entry) => db.prepare(
    `INSERT OR IGNORE INTO brisage_coefficients (server_id, item_id, coefficient, noted_at, device_id) VALUES (?, ?, ?, ?, ?)`,
  ).bind(entry.serverId, entry.itemId, entry.coefficient, entry.notedAt, payload.deviceId)));
}

type CoefficientRow = { item_id: string; coefficient: number; noted_at: string };

// GET /brisage-coefficients?serverId=&itemIds=a,b : for each item, its latest coefficient of the last 90 days.
// Items nobody noted are left out; the contributor's device identifier is never returned.
export async function coefficientsResponse<S, B>(db: CoefficientDb<S, B>, url: URL, now: Date = new Date()): Promise<{ status: number; body: unknown }> {
  const serverId = url.searchParams.get('serverId');
  const itemIds = [...new Set((url.searchParams.get('itemIds') ?? '').split(',').map((id) => id.trim()).filter(Boolean))];
  if (!serverId || itemIds.length === 0 || itemIds.length > MAX_ITEMS_PER_READ) {
    return { status: 400, body: { error: `serverId and 1 to ${MAX_ITEMS_PER_READ} itemIds are required` } };
  }
  const { results } = await db.prepare(
    `SELECT c.item_id, c.coefficient, c.noted_at FROM brisage_coefficients c
     WHERE c.server_id = ? AND c.noted_at >= ? AND c.item_id IN (${itemIds.map(() => '?').join(', ')})
       AND c.noted_at = (SELECT MAX(n.noted_at) FROM brisage_coefficients n
         WHERE n.server_id = c.server_id AND n.item_id = c.item_id AND n.noted_at >= ?)`,
  ).bind(serverId, retentionCutoff(now), ...itemIds, retentionCutoff(now)).all<CoefficientRow>();
  // Two notes at the very same instant (two devices): either is the latest; the last row read is kept.
  const byItem = new Map<string, CoefficientRow>();
  for (const row of results) byItem.set(row.item_id, row);
  return {
    status: 200,
    body: {
      serverId,
      coefficients: itemIds.filter((id) => byItem.has(id)).map((itemId) => ({
        itemId, coefficient: byItem.get(itemId)!.coefficient, notedAt: byItem.get(itemId)!.noted_at,
      })),
    },
  };
}

type PurgeDb = { prepare(sql: string): { bind(...values: unknown[]): { run(): Promise<{ meta: { changes: number } }> } } };

// Run by the weekly cron (index.ts), with the retention of the price contributions.
export async function purgeExpiredCoefficients(db: PurgeDb, now: Date = new Date()): Promise<number> {
  const result = await db.prepare('DELETE FROM brisage_coefficients WHERE noted_at < ?').bind(retentionCutoff(now)).run();
  return result.meta.changes;
}
