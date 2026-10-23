import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleApi, type Env } from '../../admin-worker/src/index';
import { createTestD1 } from '../support/sqlite-d1';

// specs/073-admin-nettoyage-donnees (data-model.md, contracts/admin-data-api.md).
const NOW = new Date('2026-10-23T12:00:00.000Z');
const owner = vi.fn().mockResolvedValue({ email: 'owner@example.com' });
const stranger = vi.fn().mockResolvedValue({ email: 'someone@else.com' });

let test: ReturnType<typeof createTestD1>;
let env: Env;

const minutesAgo = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000).toISOString();

function addCoefficient(notedAt: string, server = 'mikhal', item = '100'): number {
  const result = test.sqlite.prepare(
    "INSERT INTO brisage_coefficients (server_id, item_id, coefficient, noted_at, device_id) VALUES (?, ?, 110, ?, 'device-secret')",
  ).run(server, item, notedAt);
  return Number(result.lastInsertRowid);
}

function addPrice(createdAt: string, origin = 'manual', server = 'mikhal'): string {
  const id = crypto.randomUUID();
  test.sqlite.prepare(
    `INSERT INTO community_price_contributions (id, resource_id, server_id, amount_kamas, device_id, created_at, origin)
     VALUES (?, 'resource-1', ?, 100, 'device-secret', ?, ?)`,
  ).run(id, server, createdAt, origin);
  return id;
}

function addExternal(resourceId: string, fetchedAt: string): void {
  test.sqlite.prepare(
    `INSERT INTO external_prices (source, resource_id, server_id, unit_price_kamas, observed_at, fetched_at)
     VALUES ('huzounet', ?, 'mikhal', 50, ?, ?)`,
  ).run(resourceId, fetchedAt, fetchedAt);
}

const count = (table: string) => Number((test.sqlite.prepare(`SELECT COUNT(*) AS total FROM ${table}`).get() as { total: number }).total);

function call(method: string, path: string, body?: unknown, verify = owner) {
  const request = new Request(`https://dofus-craft-admin.example.workers.dev${path}`, {
    method,
    headers: { 'Cf-Access-Jwt-Assertion': 'jwt', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return handleApi(request, env, verify);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  test = createTestD1();
  env = {
    DB: test.d1 as unknown as Env['DB'],
    ASSETS: { fetch: vi.fn() },
    TEAM_DOMAIN: 'https://dofus.cloudflareaccess.com',
    POLICY_AUD: 'aud',
    OWNER_EMAIL: 'owner@example.com',
  };
});

describe('GET /api/data', () => {
  it('lists the three cleanable tables and an empty trace', async () => {
    const response = await call('GET', '/api/data');
    expect(response.status).toBe(200);
    const body = await response.json() as { tables: { id: string; filters: string[] }[]; log: unknown[] };
    expect(body.tables.map((table) => table.id)).toEqual(['brisage-coefficients', 'prix-communaute', 'prix-externes']);
    expect(body.tables.find((table) => table.id === 'prix-communaute')?.filters).toEqual(['server', 'origin']);
    expect(body.log).toEqual([]);
  });

  it('refuses a request that is not from the owner', async () => {
    expect((await call('GET', '/api/data', undefined, stranger)).status).toBe(403);
    expect((await call('DELETE', '/api/data/brisage-coefficients', { keys: ['1'] }, stranger)).status).toBe(403);
  });
});

describe('GET /api/data/:table', () => {
  it('returns the most recent rows first, 50 at most, without the device identifier', async () => {
    for (let index = 0; index < 55; index += 1) addCoefficient(minutesAgo(index + 1), 'mikhal', String(index));
    const response = await call('GET', '/api/data/brisage-coefficients');
    const text = await response.text();
    const body = JSON.parse(text) as { rows: { key: string; date: string; cells: Record<string, unknown> }[] };
    expect(body.rows).toHaveLength(50);
    expect(body.rows[0].date).toBe(minutesAgo(1));
    expect(body.rows[49].date).toBe(minutesAgo(50));
    expect(body.rows[0].cells).toEqual({ server_id: 'mikhal', item_id: '0', coefficient: 110 });
    expect(text).not.toContain('device');
  });

  it('honours the limit and refuses one that is out of range', async () => {
    for (let index = 0; index < 5; index += 1) addCoefficient(minutesAgo(index));
    const body = await (await call('GET', '/api/data/brisage-coefficients?limit=2')).json() as { rows: unknown[] };
    expect(body.rows).toHaveLength(2);
    expect((await call('GET', '/api/data/brisage-coefficients?limit=0')).status).toBe(400);
    expect((await call('GET', '/api/data/brisage-coefficients?limit=51')).status).toBe(400);
  });

  it('filters community prices by origin and by server', async () => {
    addPrice(minutesAgo(1), 'sniffer', 'mikhal');
    addPrice(minutesAgo(2), 'manual', 'mikhal');
    addPrice(minutesAgo(3), 'sniffer', 'draconiros');
    const sniffer = await (await call('GET', '/api/data/prix-communaute?origin=sniffer')).json() as { rows: unknown[] };
    expect(sniffer.rows).toHaveLength(2);
    const both = await (await call('GET', '/api/data/prix-communaute?origin=sniffer&server=mikhal')).json() as { rows: unknown[] };
    expect(both.rows).toHaveLength(1);
  });

  it('refuses a filter the table does not have, an invalid one, and an unknown table', async () => {
    expect((await call('GET', '/api/data/brisage-coefficients?origin=sniffer')).status).toBe(400);
    expect((await call('GET', '/api/data/prix-communaute?origin=robot')).status).toBe(400);
    expect((await call('GET', "/api/data/prix-communaute?server=a'%20OR%201=1")).status).toBe(400);
    const unknown = await call('GET', '/api/data/fm_players');
    expect(unknown.status).toBe(404);
    expect((await call('GET', '/api/data/%E0%A4%A')).status).toBe(404);
    expect((await call('DELETE', '/api/data/fm_players', { keys: ['1'] })).status).toBe(404);
  });

  it('lists the external prices with a row key', async () => {
    addExternal('r1', minutesAgo(5));
    const body = await (await call('GET', '/api/data/prix-externes')).json() as { rows: { key: string; cells: Record<string, unknown> }[] };
    expect(body.rows).toHaveLength(1);
    expect(body.rows[0].key).toMatch(/^\d+$/);
    expect(body.rows[0].cells.source).toBe('huzounet');
  });
});

describe('DELETE /api/data/:table with keys', () => {
  it('deletes exactly the given rows and leaves the others', async () => {
    const [first, second, third] = [addCoefficient(minutesAgo(1)), addCoefficient(minutesAgo(2)), addCoefficient(minutesAgo(3))];
    const response = await call('DELETE', '/api/data/brisage-coefficients', { keys: [String(first), String(second)] });
    expect(await response.json()).toEqual({ deleted: 2, logged: true });
    expect(test.sqlite.prepare('SELECT id FROM brisage_coefficients').all()).toEqual([{ id: third }]);
  });

  it('deletes community prices by id and external prices by row key', async () => {
    const kept = addPrice(minutesAgo(1));
    const removed = addPrice(minutesAgo(2));
    expect(await (await call('DELETE', '/api/data/prix-communaute', { keys: [removed] })).json()).toEqual({ deleted: 1, logged: true });
    expect(test.sqlite.prepare('SELECT id FROM community_price_contributions').all()).toEqual([{ id: kept }]);

    addExternal('r1', minutesAgo(5));
    addExternal('r2', minutesAgo(6));
    const rows = await (await call('GET', '/api/data/prix-externes')).json() as { rows: { key: string; cells: { resource_id: string } }[] };
    const target = rows.rows.find((row) => row.cells.resource_id === 'r1')!;
    expect(await (await call('DELETE', '/api/data/prix-externes', { keys: [target.key] })).json()).toEqual({ deleted: 1, logged: true });
    expect(test.sqlite.prepare('SELECT resource_id FROM external_prices').all()).toEqual([{ resource_id: 'r2' }]);
  });

  it('ignores a key that is already gone and counts the rows really deleted', async () => {
    const id = addCoefficient(minutesAgo(1));
    const body = await (await call('DELETE', '/api/data/brisage-coefficients', { keys: [String(id), '99999'] })).json();
    expect(body).toEqual({ deleted: 1, logged: true });
  });

  it('deletes by packets: 500 keys go in one call', async () => {
    const ids: string[] = [];
    for (let index = 0; index < 500; index += 1) ids.push(String(addCoefficient(minutesAgo(1), 'mikhal', String(index))));
    expect(await (await call('DELETE', '/api/data/brisage-coefficients', { keys: ids })).json()).toEqual({ deleted: 500, logged: true });
    expect(count('brisage_coefficients')).toBe(0);
  });

  it('refuses 501 keys, no key, a duplicate, a non-numeric key and a bad body, deleting nothing', async () => {
    const id = addCoefficient(minutesAgo(1));
    const tooMany = Array.from({ length: 501 }, (_, index) => String(index + 1));
    expect((await call('DELETE', '/api/data/brisage-coefficients', { keys: tooMany })).status).toBe(422);
    expect((await call('DELETE', '/api/data/brisage-coefficients', { keys: [] })).status).toBe(400);
    expect((await call('DELETE', '/api/data/brisage-coefficients', { keys: [String(id), String(id)] })).status).toBe(400);
    expect((await call('DELETE', '/api/data/brisage-coefficients', { keys: ['1 OR 1=1'] })).status).toBe(400);
    expect((await call('DELETE', '/api/data/brisage-coefficients', { keys: [1] })).status).toBe(400);
    expect((await call('DELETE', '/api/data/brisage-coefficients', {})).status).toBe(400);
    expect(count('brisage_coefficients')).toBe(1);
    expect(count('admin_cleanup_log')).toBe(0);
  });
});

describe('GET /api/data/:table/count and DELETE by duration', () => {
  function seedPrices() {
    addPrice(minutesAgo(5), 'sniffer');
    addPrice(minutesAgo(9), 'manual');
    addPrice(minutesAgo(30), 'sniffer');
    addPrice(minutesAgo(600), 'sniffer');
    addPrice(minutesAgo(3000), 'sniffer');
  }
  const counted = async (query: string) => (await (await call('GET', `/api/data/prix-communaute/count?${query}`)).json() as { count: number }).count;

  it('counts the rows newer than the duration, with and without a filter', async () => {
    seedPrices();
    expect(await counted('since=10m')).toBe(2);
    expect(await counted('since=1h')).toBe(3);
    expect(await counted('since=24h')).toBe(4);
    expect(await counted('since=24h&origin=sniffer')).toBe(3);
    expect(await counted('since=10m&origin=sniffer&server=mikhal')).toBe(1);
    expect(await counted('since=10m&server=draconiros')).toBe(0);
  });

  it('includes the exact limit of the duration and excludes what is older', async () => {
    addPrice(minutesAgo(10));
    addPrice(minutesAgo(10.01));
    expect(await counted('since=10m')).toBe(1);
  });

  it('refuses an unknown duration', async () => {
    expect((await call('GET', '/api/data/prix-communaute/count?since=2h')).status).toBe(400);
    expect((await call('GET', '/api/data/prix-communaute/count')).status).toBe(400);
    expect((await call('DELETE', '/api/data/prix-communaute', { since: '2h', expectedCount: 1 })).status).toBe(400);
  });

  it('deletes exactly the rows of the duration and the filter', async () => {
    seedPrices();
    const response = await call('DELETE', '/api/data/prix-communaute', { since: '1h', origin: 'sniffer', expectedCount: 2 });
    expect(await response.json()).toEqual({ deleted: 2, logged: true });
    expect(count('community_price_contributions')).toBe(3);
    expect(test.sqlite.prepare("SELECT COUNT(*) AS total FROM community_price_contributions WHERE origin = 'manual'").get()).toEqual({ total: 1 });
  });

  it('refuses when the count changed since the preview, deleting nothing', async () => {
    seedPrices();
    const response = await call('DELETE', '/api/data/prix-communaute', { since: '1h', expectedCount: 2 });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ count: 3 });
    expect(count('community_price_contributions')).toBe(5);
  });

  it('requires the expected count', async () => {
    seedPrices();
    expect((await call('DELETE', '/api/data/prix-communaute', { since: '1h' })).status).toBe(400);
    expect((await call('DELETE', '/api/data/prix-communaute', { since: '1h', expectedCount: 0 })).status).toBe(400);
    expect(count('community_price_contributions')).toBe(5);
  });

  it('deletes exactly 500 rows and refuses 501, deleting nothing', async () => {
    for (let index = 0; index < 501; index += 1) addPrice(minutesAgo(1));
    const refused = await call('DELETE', '/api/data/prix-communaute', { since: '10m', expectedCount: 501 });
    expect(refused.status).toBe(422);
    expect(await refused.json()).toMatchObject({ count: 501 });
    expect(count('community_price_contributions')).toBe(501);

    test.sqlite.prepare('DELETE FROM community_price_contributions WHERE rowid = (SELECT MIN(rowid) FROM community_price_contributions)').run();
    expect(await (await call('DELETE', '/api/data/prix-communaute', { since: '10m', expectedCount: 500 })).json()).toEqual({ deleted: 500, logged: true });
    expect(count('community_price_contributions')).toBe(0);
  });

  it('works on the coefficients and the external prices too', async () => {
    addCoefficient(minutesAgo(2));
    addCoefficient(minutesAgo(200));
    addExternal('r1', minutesAgo(2));
    addExternal('r2', minutesAgo(200));
    expect(await (await call('DELETE', '/api/data/brisage-coefficients', { since: '1h', expectedCount: 1 })).json()).toEqual({ deleted: 1, logged: true });
    expect(await (await call('DELETE', '/api/data/prix-externes', { since: '1h', expectedCount: 1 })).json()).toEqual({ deleted: 1, logged: true });
    expect(count('brisage_coefficients')).toBe(1);
    expect(test.sqlite.prepare('SELECT resource_id FROM external_prices').all()).toEqual([{ resource_id: 'r2' }]);
  });
});

describe('the trace of the deletions', () => {
  const logOf = async () => (await (await call('GET', '/api/data')).json() as { log: Record<string, unknown>[] }).log;

  it('records a deletion by selection and a deletion by duration', async () => {
    const id = addCoefficient(minutesAgo(1));
    await call('DELETE', '/api/data/brisage-coefficients', { keys: [String(id)] });
    vi.setSystemTime(new Date(NOW.getTime() + 1000));
    addPrice(minutesAgo(1), 'sniffer');
    await call('DELETE', '/api/data/prix-communaute', { since: '1h', origin: 'sniffer', server: 'mikhal', expectedCount: 1 });
    const log = await logOf();
    expect(log).toHaveLength(2);
    expect(log[0]).toMatchObject({ table: 'prix-communaute', mode: 'duration', filter: 'durée 1h · serveur mikhal · origine sniffer', count: 1 });
    expect(log[1]).toMatchObject({ table: 'brisage-coefficients', mode: 'selection', filter: '', count: 1, deletedAt: NOW.toISOString() });
  });

  it('records nothing for a deletion that removed nothing or was refused', async () => {
    addPrice(minutesAgo(1));
    expect(await (await call('DELETE', '/api/data/brisage-coefficients', { keys: ['12345'] })).json()).toEqual({ deleted: 0, logged: false });
    await call('DELETE', '/api/data/prix-communaute', { since: '1h', expectedCount: 9 });
    await call('DELETE', '/api/data/prix-communaute', { since: '3h', expectedCount: 1 });
    await call('DELETE', '/api/data/prix-communaute', {});
    expect(await logOf()).toEqual([]);
  });

  it('shows the 20 latest entries, the most recent first', async () => {
    for (let index = 0; index < 22; index += 1) {
      vi.setSystemTime(new Date(NOW.getTime() + index * 1000));
      await call('DELETE', '/api/data/brisage-coefficients', { keys: [String(addCoefficient(minutesAgo(1)))] });
    }
    const log = await logOf();
    expect(log).toHaveLength(20);
    expect(log[0].deletedAt).toBe(new Date(NOW.getTime() + 21_000).toISOString());
  });

  it('keeps the deletion and says so when the trace cannot be written', async () => {
    const id = addCoefficient(minutesAgo(1));
    test.sqlite.exec('DROP TABLE admin_cleanup_log');
    const response = await call('DELETE', '/api/data/brisage-coefficients', { keys: [String(id)] });
    expect(await response.json()).toEqual({ deleted: 1, logged: false });
    expect(count('brisage_coefficients')).toBe(0);
  });
});
