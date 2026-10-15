import { randomHex, sha256Hex } from '../../worker/src/fm/http';

// specs/057-sniffer-admin (contracts/admin-sniffer-api.md « Clés »): the keys of the friends' HDV price
// tool, in the sniffer_keys table of specs/056. Only the key's SHA-256 is stored, computed by the same
// sha256Hex the API checks it with (worker/src/sniffer.ts authenticateSnifferKey); the key itself is
// only ever in the creation's answer. Reachable only through the Access-protected API (src/index.ts).
type Statement = {
  bind(...values: unknown[]): Statement;
  all<T>(): Promise<{ results: T[] }>;
  first<T>(): Promise<T | null>;
  run(): Promise<{ meta: { changes: number } }>;
};
export type SnifferKeysDb = { prepare(sql: string): Statement };

export type SnifferKeyJson = {
  id: string;
  label: string;
  createdAt: string;
  revokedAt: string | null;
  lastSeenAt: string | null;
  rowsToday: number;
};

type SnifferKeyRow = { id: string; label: string; created_at: string; revoked_at: string | null; last_seen_at: string | null; rows_today: number };

export const MAX_LABEL_LENGTH = 60;
// Recognisable when pasted in the wrong place; 32 random bytes after it (research R1).
export const KEY_PREFIX = 'dcp_';

export type LabelValidation = { ok: true; value: string } | { ok: false; error: string; field: 'label' };

export function validateKeyLabel(body: unknown): LabelValidation {
  const raw = (body as Record<string, unknown> | null | undefined)?.label;
  const label = typeof raw === 'string' ? raw.trim() : '';
  if (!label || label.length > MAX_LABEL_LENGTH) {
    return { ok: false, error: `Libellé obligatoire (${MAX_LABEL_LENGTH} caractères au plus).`, field: 'label' };
  }
  return { ok: true, value: label };
}

// The day's count is the one the batch route caps (UTC day, specs/056 research).
const SELECT_KEYS = `SELECT k.id, k.label, k.created_at, k.revoked_at, k.last_seen_at, COALESCE(u.rows_written, 0) AS rows_today
  FROM sniffer_keys k LEFT JOIN sniffer_daily_usage u ON u.key_id = k.id AND u.day = ?`;

const keyFromRow = (row: SnifferKeyRow): SnifferKeyJson => ({
  id: row.id,
  label: row.label,
  createdAt: row.created_at,
  revokedAt: row.revoked_at,
  lastSeenAt: row.last_seen_at,
  rowsToday: Number(row.rows_today),
});

const utcDay = (now: Date) => now.toISOString().slice(0, 10);

export async function listKeys(db: SnifferKeysDb, now: Date = new Date()): Promise<SnifferKeyJson[]> {
  const { results } = await db.prepare(`${SELECT_KEYS} ORDER BY k.created_at DESC, k.id`).bind(utcDay(now)).all<SnifferKeyRow>();
  return results.map(keyFromRow);
}

async function getKey(db: SnifferKeysDb, id: string, now: Date): Promise<SnifferKeyJson | null> {
  const row = await db.prepare(`${SELECT_KEYS} WHERE k.id = ?`).bind(utcDay(now), id).first<SnifferKeyRow>();
  return row ? keyFromRow(row) : null;
}

export async function createKey(
  db: SnifferKeysDb,
  label: string,
  now: Date = new Date(),
  id: string = crypto.randomUUID(),
): Promise<{ key: SnifferKeyJson; secret: string }> {
  const secret = `${KEY_PREFIX}${randomHex(32)}`;
  await db.prepare('INSERT INTO sniffer_keys (id, label, key_hash, created_at) VALUES (?, ?, ?, ?)')
    .bind(id, label, await sha256Hex(secret), now.toISOString())
    .run();
  return { key: (await getKey(db, id, now))!, secret };
}

// Revoking twice keeps the first date; a revoked key is never made active again (a new key instead).
export async function revokeKey(db: SnifferKeysDb, id: string, now: Date = new Date()): Promise<SnifferKeyJson | null> {
  const result = await db.prepare('UPDATE sniffer_keys SET revoked_at = COALESCE(revoked_at, ?) WHERE id = ?')
    .bind(now.toISOString(), id)
    .run();
  return result.meta.changes > 0 ? getKey(db, id, now) : null;
}
