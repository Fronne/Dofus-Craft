// specs/073-admin-nettoyage-donnees (contracts/admin-data-api.md): the administration page lists the most recent
// rows of a few tables and deletes some of them. The registry below is the only place SQL names come from: what
// a request carries (table id, filters, keys, duration) is validated and bound as parameters, never written into
// the SQL. `device_id` is in no column list, so it can never be returned.
type Statement = {
  bind(...values: unknown[]): Statement;
  all<T>(): Promise<{ results: T[] }>;
  first<T>(): Promise<T | null>;
  run(): Promise<{ meta: { changes: number } }>;
};
export type CleanupDb = { prepare(sql: string): Statement; batch(statements: Statement[]): Promise<unknown> };

export const MAX_ROWS = 500;
export const LIST_LIMIT = 50;
export const LOG_LIMIT = 20;
// D1 allows 100 bound parameters per query: ids are deleted by packets, in one atomic batch.
const PACKET = 90;

export const DURATIONS = { '10m': 10 * 60_000, '1h': 60 * 60_000, '24h': 24 * 60 * 60_000 } as const;
export type Duration = keyof typeof DURATIONS;
export const ORIGINS = ['manual', 'capture', 'bot', 'sniffer'] as const;
export type FilterId = 'server' | 'origin';

type Column = { id: string; label: string };
type CleanupTable = {
  id: string;
  label: string;
  table: string;
  keyColumn: string;
  numericKey: boolean;
  dateColumn: string;
  columns: Column[];
  filters: FilterId[];
};

export const CLEANUP_TABLES: CleanupTable[] = [
  {
    id: 'brisage-coefficients',
    label: 'Coefficients de brisage',
    table: 'brisage_coefficients',
    keyColumn: 'id',
    numericKey: true,
    dateColumn: 'noted_at',
    columns: [
      { id: 'server_id', label: 'Serveur' },
      { id: 'item_id', label: 'Objet' },
      { id: 'coefficient', label: 'Coefficient' },
    ],
    filters: ['server'],
  },
  {
    id: 'prix-communaute',
    label: 'Prix de la communauté',
    table: 'community_price_contributions',
    keyColumn: 'id',
    numericKey: false,
    dateColumn: 'created_at',
    columns: [
      { id: 'server_id', label: 'Serveur' },
      { id: 'resource_id', label: 'Ressource ou objet' },
      { id: 'amount_kamas', label: 'Prix (kamas)' },
      { id: 'origin', label: 'Origine' },
      { id: 'item_type', label: 'Type' },
    ],
    filters: ['server', 'origin'],
  },
  {
    id: 'prix-externes',
    label: 'Prix externes',
    table: 'external_prices',
    keyColumn: 'rowid',
    numericKey: true,
    dateColumn: 'fetched_at',
    columns: [
      { id: 'source', label: 'Source' },
      { id: 'server_id', label: 'Serveur' },
      { id: 'resource_id', label: 'Ressource' },
      { id: 'unit_price_kamas', label: 'Prix unitaire (kamas)' },
    ],
    filters: ['server'],
  },
];

export const findTable = (id: string): CleanupTable | undefined => CLEANUP_TABLES.find((table) => table.id === id);

export type Failure = { ok: false; status: 400 | 404 | 409 | 422; error: string; field?: string; count?: number };
const failure = (status: Failure['status'], error: string, field?: string, count?: number): Failure => ({ ok: false, status, error, field, count });

export type Filters = { server?: string; origin?: string };
export type Cell = string | number | null;
export type CleanupRow = { key: string; date: string; cells: Record<string, Cell> };
export type CleanupLogEntry = { id: number; deletedAt: string; table: string; mode: 'selection' | 'duration'; filter: string; count: number };

const SERVER_PATTERN = /^[a-z0-9_-]{1,40}$/;

export function validateFilters(table: CleanupTable, input: { server?: unknown; origin?: unknown }): { ok: true; value: Filters } | Failure {
  const value: Filters = {};
  if (input.server !== undefined && input.server !== null && input.server !== '') {
    if (!table.filters.includes('server') || typeof input.server !== 'string' || !SERVER_PATTERN.test(input.server)) {
      return failure(400, 'Serveur invalide.', 'server');
    }
    value.server = input.server;
  }
  if (input.origin !== undefined && input.origin !== null && input.origin !== '') {
    if (!table.filters.includes('origin') || !ORIGINS.includes(input.origin as (typeof ORIGINS)[number])) {
      return failure(400, 'Origine invalide.', 'origin');
    }
    value.origin = input.origin as string;
  }
  return { ok: true, value };
}

export const isDuration = (value: unknown): value is Duration => typeof value === 'string' && Object.hasOwn(DURATIONS, value);

export function describeTables() {
  return CLEANUP_TABLES.map(({ id, label, columns, filters }) => ({ id, label, columns, filters }));
}

function whereOf(table: CleanupTable, filters: Filters, since?: string): { sql: string; params: string[] } {
  const clauses: string[] = [];
  const params: string[] = [];
  if (since !== undefined) {
    clauses.push(`${table.dateColumn} >= ?`);
    params.push(since);
  }
  if (filters.server !== undefined) {
    clauses.push('server_id = ?');
    params.push(filters.server);
  }
  if (filters.origin !== undefined) {
    clauses.push('origin = ?');
    params.push(filters.origin);
  }
  return { sql: clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '', params };
}

export async function listRows(db: CleanupDb, table: CleanupTable, filters: Filters, limit: number = LIST_LIMIT): Promise<CleanupRow[]> {
  const { sql, params } = whereOf(table, filters);
  const columns = table.columns.map((column) => column.id).join(', ');
  const { results } = await db.prepare(
    `SELECT CAST(${table.keyColumn} AS TEXT) AS row_key, ${table.dateColumn} AS row_date, ${columns} FROM ${table.table}${sql} ORDER BY ${table.dateColumn} DESC, ${table.keyColumn} DESC LIMIT ?`,
  ).bind(...params, limit).all<Record<string, Cell>>();
  return results.map((row) => ({
    key: String(row.row_key),
    date: String(row.row_date),
    cells: Object.fromEntries(table.columns.map((column) => [column.id, row[column.id] ?? null])),
  }));
}

export const sinceLimit = (duration: Duration, now: Date): string => new Date(now.getTime() - DURATIONS[duration]).toISOString();

export async function countRecent(db: CleanupDb, table: CleanupTable, duration: Duration, filters: Filters, now: Date = new Date()): Promise<number> {
  const { sql, params } = whereOf(table, filters, sinceLimit(duration, now));
  const row = await db.prepare(`SELECT COUNT(*) AS total FROM ${table.table}${sql}`).bind(...params).first<{ total: number }>();
  return Number(row?.total ?? 0);
}

export type DeleteResult = { ok: true; deleted: number; logged: boolean } | Failure;

export function validateKeys(table: CleanupTable, raw: unknown): { ok: true; value: string[] } | Failure {
  if (!Array.isArray(raw) || raw.length === 0) return failure(400, 'Aucune ligne sélectionnée.', 'keys');
  if (raw.length > MAX_ROWS) return failure(422, `Une suppression porte sur ${MAX_ROWS} lignes au plus.`, 'keys', raw.length);
  const keys: string[] = [];
  for (const key of raw) {
    const valid = typeof key === 'string' && key.length >= 1 && key.length <= 64 && (!table.numericKey || /^\d{1,15}$/.test(key));
    if (!valid) return failure(400, 'Identifiant de ligne invalide.', 'keys');
    keys.push(key);
  }
  if (new Set(keys).size !== keys.length) return failure(400, 'Identifiants en double.', 'keys');
  return { ok: true, value: keys };
}

export async function deleteByKeys(db: CleanupDb, table: CleanupTable, keys: string[], now: Date = new Date()): Promise<DeleteResult> {
  const statements: Statement[] = [];
  for (let start = 0; start < keys.length; start += PACKET) {
    const packet = keys.slice(start, start + PACKET);
    const marks = packet.map(() => '?').join(', ');
    const values = table.numericKey ? packet.map(Number) : packet;
    statements.push(db.prepare(`DELETE FROM ${table.table} WHERE ${table.keyColumn} IN (${marks})`).bind(...values));
  }
  const results = (await db.batch(statements)) as { meta: { changes: number } }[];
  const deleted = results.reduce((sum, result) => sum + Number(result.meta.changes), 0);
  return { ok: true, deleted, logged: await writeLog(db, table, 'selection', '', deleted, now) };
}

export function filterText(duration: Duration | undefined, filters: Filters): string {
  const parts: string[] = [];
  if (duration !== undefined) parts.push(`durée ${duration}`);
  if (filters.server !== undefined) parts.push(`serveur ${filters.server}`);
  if (filters.origin !== undefined) parts.push(`origine ${filters.origin}`);
  return parts.join(' · ');
}

export async function deleteRecent(
  db: CleanupDb,
  table: CleanupTable,
  duration: Duration,
  filters: Filters,
  expectedCount: number,
  now: Date = new Date(),
): Promise<DeleteResult> {
  const count = await countRecent(db, table, duration, filters, now);
  if (count > MAX_ROWS) {
    return failure(422, `${count} lignes concernées : une suppression porte sur ${MAX_ROWS} lignes au plus. Choisissez une durée plus courte ou un filtre.`, undefined, count);
  }
  if (count !== expectedCount) {
    return failure(409, `Le nombre de lignes a changé (${count} au lieu de ${expectedCount}) : relancez l'aperçu.`, undefined, count);
  }
  const { sql, params } = whereOf(table, filters, sinceLimit(duration, now));
  const result = await db.prepare(
    `DELETE FROM ${table.table} WHERE ${table.keyColumn} IN (SELECT ${table.keyColumn} FROM ${table.table}${sql} LIMIT ${expectedCount})`,
  ).bind(...params).run();
  const deleted = Number(result.meta.changes);
  return { ok: true, deleted, logged: await writeLog(db, table, 'duration', filterText(duration, filters), deleted, now) };
}

// Written after the deletion, once the real count is known. A failed trace never undoes a deletion: it is
// reported as `logged: false`. No trace for a deletion that removed nothing.
async function writeLog(db: CleanupDb, table: CleanupTable, mode: 'selection' | 'duration', filter: string, count: number, now: Date): Promise<boolean> {
  if (count <= 0) return false;
  try {
    await db.prepare('INSERT INTO admin_cleanup_log (deleted_at, table_id, mode, filter_text, row_count) VALUES (?, ?, ?, ?, ?)')
      .bind(now.toISOString(), table.id, mode, filter, count)
      .run();
    return true;
  } catch {
    return false;
  }
}

export async function readLog(db: CleanupDb): Promise<CleanupLogEntry[]> {
  const { results } = await db.prepare(
    'SELECT id, deleted_at, table_id, mode, filter_text, row_count FROM admin_cleanup_log ORDER BY deleted_at DESC, id DESC LIMIT ?',
  ).bind(LOG_LIMIT).all<{ id: number; deleted_at: string; table_id: string; mode: 'selection' | 'duration'; filter_text: string; row_count: number }>();
  return results.map((row) => ({
    id: Number(row.id),
    deletedAt: row.deleted_at,
    table: row.table_id,
    mode: row.mode,
    filter: row.filter_text,
    count: Number(row.row_count),
  }));
}

export type DeleteRequest =
  | { kind: 'keys'; keys: string[] }
  | { kind: 'recent'; duration: Duration; filters: Filters; expectedCount: number };

export function validateDeleteBody(table: CleanupTable, body: unknown): { ok: true; value: DeleteRequest } | Failure {
  const record = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  if (record.keys !== undefined) {
    const keys = validateKeys(table, record.keys);
    return keys.ok ? { ok: true, value: { kind: 'keys', keys: keys.value } } : keys;
  }
  if (record.since === undefined) return failure(400, 'Indiquez des lignes à supprimer ou une durée.', 'since');
  if (!isDuration(record.since)) return failure(400, 'Durée invalide (10m, 1h ou 24h).', 'since');
  if (!Number.isInteger(record.expectedCount) || (record.expectedCount as number) < 1) {
    return failure(400, "Le nombre de lignes attendu est obligatoire (aperçu d'abord).", 'expectedCount');
  }
  const filters = validateFilters(table, record);
  if (!filters.ok) return filters;
  return { ok: true, value: { kind: 'recent', duration: record.since, filters: filters.value, expectedCount: record.expectedCount as number } };
}
