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
    // The one older table these migrations touch (0007 adds its `origin` column, 0019 rebuilds it), as it
    // was before 0007.
    migrated.exec(`CREATE TABLE community_price_contributions (id TEXT PRIMARY KEY, resource_id TEXT NOT NULL,
      server_id TEXT NOT NULL, amount_kamas INTEGER NOT NULL, device_id TEXT NOT NULL DEFAULT '',
      median_at_submission_kamas INTEGER, deviation_percent REAL, kind TEXT NOT NULL DEFAULT 'resource',
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')))`);
    migrated.exec("INSERT INTO community_price_contributions (id, resource_id, server_id, amount_kamas) VALUES ('kept', '1', 'mikhal', 10)");
    const directory = resolve(process.cwd(), 'worker/migrations');
    for (const file of readdirSync(directory).filter((name) => name >= '0007').sort()) {
      migrated.exec(readFileSync(resolve(directory, file), 'utf8'));
    }
    // specs/050-forgemagie-page-toggle: site_settings comes from a migration of that range too (0016).
    // specs/056-sniffer-batch-prices: so do the sniffer tables (0018); specs/059-prix-par-lot: and the lot prices (0020).
    // specs/069-coefficients-brisage-partages: and the shared breaking coefficients (0021).
    const restored = tables(fresh).filter((name) => name.startsWith('fm_') || name.startsWith('external_') || name.startsWith('sniffer_') || name === 'site_settings' || name === 'community_price_lots' || name === 'brisage_coefficients');
    expect(tables(migrated).filter((name) => name !== 'community_price_contributions')).toEqual(restored);
    for (const table of restored) expect([table, columns(migrated, table)]).toEqual([table, columns(fresh, table)]);
    // 0019 keeps every contribution and every column, and accepts the 'sniffer' origin.
    expect(columns(migrated, 'community_price_contributions')).toEqual(columns(fresh, 'community_price_contributions'));
    expect(migrated.prepare('SELECT id, origin FROM community_price_contributions').all()).toEqual([{ id: 'kept', origin: 'manual' }]);
    migrated.exec("INSERT INTO community_price_contributions (id, resource_id, server_id, amount_kamas, origin) VALUES ('s', '1', 'mikhal', 10, 'sniffer')");
    expect(() => migrated.exec("INSERT INTO community_price_contributions (id, resource_id, server_id, amount_kamas, origin) VALUES ('x', '1', 'mikhal', 10, 'robot')")).toThrow();
  });

  it('adds the lot prices table (0020) without touching a contribution, and can run again', () => {
    const db = freshDatabase();
    db.exec("INSERT INTO community_price_contributions (id, resource_id, server_id, amount_kamas) VALUES ('kept', '1', 'mikhal', 10)");
    const migration = readFileSync(resolve(process.cwd(), 'worker/migrations/0020_add_lot_prices.sql'), 'utf8');
    db.exec(migration);
    db.exec(migration);
    expect(db.prepare('SELECT id, amount_kamas FROM community_price_contributions').all()).toEqual([{ id: 'kept', amount_kamas: 10 }]);
    expect(() => db.exec("INSERT INTO community_price_lots (resource_id, server_id, lot_size, lot_price_kamas, observed_at) VALUES ('1', 'mikhal', 50, 10, 'x')")).toThrow();
  });

  it('adds the shared breaking coefficients table (0021) without touching a contribution, and can run again', () => {
    const db = freshDatabase();
    db.exec("INSERT INTO community_price_contributions (id, resource_id, server_id, amount_kamas) VALUES ('kept', '1', 'mikhal', 10)");
    const migration = readFileSync(resolve(process.cwd(), 'worker/migrations/0021_add_brisage_coefficients.sql'), 'utf8');
    db.exec(migration);
    db.exec(migration);
    expect(db.prepare('SELECT id, amount_kamas FROM community_price_contributions').all()).toEqual([{ id: 'kept', amount_kamas: 10 }]);
    expect(() => db.exec("INSERT INTO brisage_coefficients (server_id, item_id, coefficient, noted_at) VALUES ('mikhal', '1', 0, 'x')")).toThrow();
    expect(() => db.exec("INSERT INTO brisage_coefficients (server_id, item_id, coefficient, noted_at) VALUES ('mikhal', '1', 4001, 'x')")).toThrow();
  });

  it('can run the origin rebuild (0019) again', () => {
    const db = freshDatabase();
    db.exec("INSERT INTO community_price_contributions (id, resource_id, server_id, amount_kamas, origin) VALUES ('a', '1', 'mikhal', 10, 'sniffer')");
    const rebuild = readFileSync(resolve(process.cwd(), 'worker/migrations/0019_add_sniffer_origin.sql'), 'utf8');
    db.exec(rebuild);
    db.exec(rebuild);
    expect(db.prepare('SELECT id, origin FROM community_price_contributions').all()).toEqual([{ id: 'a', origin: 'sniffer' }]);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'community_price_contributions' AND name NOT LIKE 'sqlite_%'").all())
      .toEqual([{ name: 'idx_community_price_contributions_lookup' }]);
  });

  it('never throws away the copy of a stopped 0019 run', () => {
    const rebuild = readFileSync(resolve(process.cwd(), 'worker/migrations/0019_add_sniffer_origin.sql'), 'utf8');
    const statements = rebuild.split(';').map((statement) => statement.trim()).filter((statement) => /^(CREATE|INSERT|DROP|ALTER)/m.test(statement));
    const insert = (db: InstanceType<typeof DatabaseSync>, id: string) =>
      db.exec(`INSERT INTO community_price_contributions (id, resource_id, server_id, amount_kamas) VALUES ('${id}', '1', 'mikhal', 10)`);

    // Stopped after a partial copy: the run again completes it.
    const partial = freshDatabase();
    insert(partial, 'a');
    insert(partial, 'b');
    partial.exec(`${statements[0]}; INSERT INTO community_price_contributions_new (id, resource_id, server_id, amount_kamas) VALUES ('a', '1', 'mikhal', 10)`);
    partial.exec(rebuild);
    expect(partial.prepare('SELECT id FROM community_price_contributions ORDER BY id').all()).toEqual([{ id: 'a' }, { id: 'b' }]);

    // Stopped after the DROP: the run again fails without touching the copy, the last two statements finish.
    const dropped = freshDatabase();
    insert(dropped, 'a');
    for (const statement of statements.slice(0, 3)) dropped.exec(statement);
    expect(() => dropped.exec(rebuild)).toThrow();
    for (const statement of statements.slice(-2)) dropped.exec(statement);
    expect(dropped.prepare('SELECT id FROM community_price_contributions').all()).toEqual([{ id: 'a' }]);
  });
});
