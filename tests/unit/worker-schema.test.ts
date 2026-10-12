import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// specs/045-restore-production-worker (data-model.md): worker/schema.sql has the structure read from the
// production database, and the migrations lead an older database to the same one.
const { DatabaseSync } = createRequire(resolve(process.cwd(), 'package.json'))('node:sqlite') as typeof import('node:sqlite');

const columns = (db: InstanceType<typeof DatabaseSync>, table: string) =>
  (db.prepare(`SELECT name FROM pragma_table_info('${table}') ORDER BY name`).all() as { name: string }[]).map((row) => row.name);

const tables = (db: InstanceType<typeof DatabaseSync>) =>
  (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[]).map((row) => row.name);

function freshDatabase() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(resolve(process.cwd(), 'worker/schema.sql'), 'utf8'));
  return db;
}

describe('worker/schema.sql', () => {
  it('has the tables and columns restored from production', () => {
    const db = freshDatabase();
    expect(columns(db, 'external_prices')).toEqual(
      ['fetched_at', 'is_item', 'observed_at', 'provisional', 'resource_id', 'server_id', 'source', 'stale', 'support', 'unit_price_kamas'],
    );
    expect(columns(db, 'external_price_sync')).toEqual(['completed_at', 'cursor', 'last_error', 'last_error_at', 'run_date', 'server_id', 'source']);
    expect(columns(db, 'fm_guild')).toEqual(['id', 'name', 'updated_at']);
    expect(columns(db, 'fm_purchase_lines')).toEqual(expect.arrayContaining(['original_quantity', 'original_total_kamas', 'corrected_at', 'original_item_name', 'counted']));
  });

  it('lets a line count by default, keeps one server name, and takes the channel requests', () => {
    const db = freshDatabase();
    db.exec("INSERT INTO fm_guild (id, name, updated_at) VALUES ('current', 'Guilde', '2026-10-01T00:00:00.000Z')");
    expect(() => db.exec("INSERT INTO fm_guild (id, name, updated_at) VALUES ('other', 'Autre', '2026-10-01T00:00:00.000Z')")).toThrow();
    for (const type of ['archive-channel', 'reopen-channel']) {
      db.prepare("INSERT INTO fm_bot_commands (id, type, channel_id, status, created_at) VALUES (?, ?, 'c1', 'pending', '2026-10-01T00:00:00.000Z')").run(type, type);
    }
    expect(() => db.exec("INSERT INTO fm_bot_commands (id, type, status, created_at) VALUES ('x', 'delete-channel', 'pending', '2026-10-01T00:00:00.000Z')")).toThrow();
    expect(() => db.exec(
      "INSERT INTO external_prices (source, resource_id, server_id, unit_price_kamas, observed_at, fetched_at) VALUES ('huzounet', '1', 'mikhal', 0, '2026-10-01', '2026-10-01')",
    )).toThrow();
  });
});

describe('worker/migrations', () => {
  // The Forgemagie tables and the external prices all come from migrations (0007 onwards): played in
  // order on an empty database, they give the tables of schema.sql, column for column.
  it('lead to the same Forgemagie and external-price tables as schema.sql', () => {
    const fresh = freshDatabase();
    const migrated = new DatabaseSync(':memory:');
    // The one older table these migrations touch (0007 adds its `origin` column).
    migrated.exec('CREATE TABLE community_price_contributions (id TEXT PRIMARY KEY)');
    const directory = resolve(process.cwd(), 'worker/migrations');
    for (const file of readdirSync(directory).filter((name) => name >= '0007').sort()) {
      migrated.exec(readFileSync(resolve(directory, file), 'utf8'));
    }
    // specs/050-forgemagie-page-toggle: site_settings comes from a migration of that range too (0016).
    const restored = tables(fresh).filter((name) => name.startsWith('fm_') || name.startsWith('external_') || name === 'site_settings');
    expect(tables(migrated).filter((name) => name !== 'community_price_contributions')).toEqual(restored);
    for (const table of restored) expect([table, columns(migrated, table)]).toEqual([table, columns(fresh, table)]);
  });
});
