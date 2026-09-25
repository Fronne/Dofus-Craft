import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

// Loaded through Node's own require: Vite's resolver doesn't know `node:sqlite` as a builtin yet.
// Paths are from the repository root (tests run there): under jsdom, import.meta.url isn't a file URL.
const { DatabaseSync } = createRequire(resolve(process.cwd(), 'package.json'))('node:sqlite') as typeof import('node:sqlite');

// A tiny D1-shaped wrapper over an in-memory SQLite database loaded with worker/schema.sql, so Worker
// code runs its real SQL in tests (specs/016) instead of asserting on query strings. Only the calls
// the Worker uses: prepare(sql).bind(...).first() / .all() / .run().
export function createTestD1() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(resolve(process.cwd(), 'worker/schema.sql'), 'utf8'));
  const d1 = {
    prepare(sql: string) {
      const bound = (params: unknown[]) => {
        const statement = db.prepare(sql);
        const args = params as (string | number | null)[];
        return {
          first: async <T>() => (statement.get(...args) as T | undefined) ?? null,
          all: async <T>() => ({ results: statement.all(...args) as T[] }),
          run: async () => ({ meta: { changes: Number(statement.run(...args).changes) } }),
        };
      };
      return { bind: (...params: unknown[]) => bound(params), ...bound([]) };
    },
  };
  const insert = (row: { resourceId: string; serverId?: string; amountKamas: number; createdAt: string; kind?: 'item' | 'resource'; deviceId?: string }) =>
    db.prepare(`INSERT INTO community_price_contributions (id, resource_id, server_id, amount_kamas, device_id, created_at, kind)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(crypto.randomUUID(), row.resourceId, row.serverId ?? 'mikhal', row.amountKamas,
      row.deviceId ?? 'device-a', row.createdAt, row.kind ?? 'resource');
  const rows = () => db.prepare('SELECT resource_id, server_id, amount_kamas, kind, created_at, median_at_submission_kamas, deviation_percent FROM community_price_contributions ORDER BY created_at')
    .all() as { resource_id: string; server_id: string; amount_kamas: number; kind: string; created_at: string; median_at_submission_kamas: number | null; deviation_percent: number | null }[];
  return { d1, insert, rows };
}
