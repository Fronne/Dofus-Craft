import { beforeEach, describe, expect, it } from 'vitest';
import { parseContributionPayload } from '../../worker/src/contribution';
import { sha256Hex } from '../../worker/src/fm/http';
import { DAILY_ROW_LIMIT, handleSniffer, isToolOutdated, MAX_BATCH_OBSERVATIONS, type SnifferEnv } from '../../worker/src/sniffer';
import { SERVERS } from '../../worker/src/servers';
import { createTestD1 } from '../support/sqlite-d1';

// specs/056-sniffer-batch-prices (contracts/sniffer-api.md): GET /sniffer/config and
// POST /community-price/batch, on the real schema. (worker/src/index.ts routes them to handleSniffer
// before the public key check; it is not imported here: it needs the Workers types.)
const KEY = 'friend-key';
const KEY_ID = 'key-1';
const RESOURCE = '7028'; // agathe, in fm/priceable-items.json
const OTHER_RESOURCE = '911'; // in priced-extras.json
const EQUIPMENT = '44'; // in equipment-items.json, never a resource

let test: ReturnType<typeof createTestD1>;
let env: SnifferEnv;

beforeEach(async () => {
  test = createTestD1();
  env = {
    DB: test.d1,
    SNIFFER_MIN_VERSION: '0.2.0',
    SNIFFER_DOWNLOAD_URL: 'https://example.test/releases/latest',
  };
  test.sqlite.prepare('INSERT INTO sniffer_keys (id, label, key_hash) VALUES (?, ?, ?)').run(KEY_ID, 'Ami', await sha256Hex(KEY));
  test.sqlite.prepare(`INSERT INTO sniffer_mappings (id, build, keymap_json, schema_json, active) VALUES (6, '3.7.10.10', '{"old":true}', '{}', 0)`).run();
  test.sqlite.prepare(`INSERT INTO sniffer_mappings (id, build, keymap_json, schema_json, active) VALUES (7, '3.7.10.10', '{"price_list":"abc"}', '{"fields":[1]}', 1)`).run();
});

async function call(method: string, path: string, body?: unknown, key: string | null = KEY) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (key !== null) headers.Authorization = `Bearer ${key}`;
  const url = new URL(`https://api.test${path}`);
  const result = await handleSniffer(new Request(url, {
    method, headers, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  }), url, env);
  if (!result) throw new Error(`not a sniffer route: ${method} ${path}`);
  return new Response(JSON.stringify(result.body), { status: result.status });
}

const observation = (itemId: string, lots: Record<string, unknown> = { 1: 24_000, 10: 231_000, 100: 2_290_000, 1000: 0 }) =>
  ({ itemId, seenAt: '2026-10-15T20:01:02Z', lots });

const batch = (observations: unknown[], fields: Record<string, unknown> = {}) =>
  ({ tool: '0.2.0', build: '3.7.10.10', mappingId: 7, serverId: 'mikhal', observations, ...fields });

const contributions = () => test.sqlite.prepare(
  'SELECT resource_id, server_id, amount_kamas, device_id, kind, origin, median_at_submission_kamas, deviation_percent FROM community_price_contributions ORDER BY rowid',
).all() as { resource_id: string; server_id: string; amount_kamas: number; device_id: string; kind: string; origin: string; median_at_submission_kamas: number | null; deviation_percent: number | null }[];

const usage = () => test.sqlite.prepare('SELECT key_id, day, rows_written FROM sniffer_daily_usage').all();

describe('POST /community-price/batch (specs/056, US1)', () => {
  it('records each observation as a sniffer resource contribution of the key', async () => {
    const response = await call('POST', '/community-price/batch', batch([observation(RESOURCE), observation(OTHER_RESOURCE, { 1: 500 })]));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ accepted: 2, rejected: [] });
    expect(contributions()).toEqual([
      { resource_id: RESOURCE, server_id: 'mikhal', amount_kamas: 22_900, device_id: KEY_ID, kind: 'resource', origin: 'sniffer', median_at_submission_kamas: null, deviation_percent: null },
      { resource_id: OTHER_RESOURCE, server_id: 'mikhal', amount_kamas: 500, device_id: KEY_ID, kind: 'resource', origin: 'sniffer', median_at_submission_kamas: null, deviation_percent: null },
    ]);
    expect(usage()).toEqual([{ key_id: KEY_ID, day: new Date().toISOString().slice(0, 10), rows_written: 2 }]); // resources only: the lot prices don't count (specs/059)
    const key = test.sqlite.prepare('SELECT last_seen_at FROM sniffer_keys WHERE id = ?').get(KEY_ID) as { last_seen_at: string | null };
    expect(key.last_seen_at).not.toBeNull();
  });

  it('fills the median and deviation as a manual entry, and never refuses a far price', async () => {
    test.insert({ resourceId: RESOURCE, amountKamas: 20_000, createdAt: new Date(Date.now() - 3_600_000).toISOString(), deviceId: 'a' });
    const response = await call('POST', '/community-price/batch', batch([observation(RESOURCE, { 1: 200_000 })]));
    await expect(response.json()).resolves.toEqual({ accepted: 1, rejected: [] });
    expect(contributions().at(-1)).toMatchObject({ amount_kamas: 200_000, origin: 'sniffer', median_at_submission_kamas: 20_000, deviation_percent: 900 });
  });

  it('settles two disagreeing lots with the community median', async () => {
    test.insert({ resourceId: RESOURCE, amountKamas: 21_000, createdAt: new Date(Date.now() - 3_600_000).toISOString(), deviceId: 'a' });
    await call('POST', '/community-price/batch', batch([observation(RESOURCE, { 1: 100_000, 100: 2_000_000 })]));
    expect(contributions().at(-1)).toMatchObject({ amount_kamas: 20_000 });
  });

  it('refuses each bad observation with its index and reason, and keeps the others', async () => {
    const response = await call('POST', '/community-price/batch', batch([
      observation(RESOURCE),
      observation(EQUIPMENT),
      observation(RESOURCE, { 1: 0, 10: 0 }),
      observation(RESOURCE, { 5: 100 }),
      { ...observation(RESOURCE), seenAt: 'hier' },
      observation(RESOURCE, { 1: -3 }),
      observation(RESOURCE, { 1: 12.5 }),
      { itemId: 7028, seenAt: '2026-10-15T20:01:02Z', lots: { 1: 1 } },
      'not an object',
    ]));
    await expect(response.json()).resolves.toEqual({
      accepted: 1,
      rejected: [
        { index: 1, reason: 'not_an_ingredient' },
        { index: 2, reason: 'no_price' },
        { index: 3, reason: 'invalid' },
        { index: 4, reason: 'invalid' },
        { index: 5, reason: 'invalid' },
        { index: 6, reason: 'invalid' },
        { index: 7, reason: 'invalid' },
        { index: 8, reason: 'invalid' },
      ],
    });
    expect(contributions()).toHaveLength(1);
  });

  it('leaves every other route to the rest of the Worker', async () => {
    const url = new URL('https://api.test/community-price');
    await expect(handleSniffer(new Request(url, { method: 'POST' }), url, env)).resolves.toBeUndefined();
  });

  it('answers an empty batch without writing anything', async () => {
    const response = await call('POST', '/community-price/batch', batch([]));
    await expect(response.json()).resolves.toEqual({ accepted: 0, rejected: [] });
    expect(usage()).toEqual([]);
  });

  it.each([
    ['no key', null],
    ['an unknown key', 'not-a-key'],
    ['the public app key', 'public-key'],
  ])('refuses %s (401)', async (_, key) => {
    const response = await call('POST', '/community-price/batch', batch([observation(RESOURCE)]), key);
    expect(response.status).toBe(401);
    expect(contributions()).toEqual([]);
  });

  it('refuses a revoked key (401)', async () => {
    test.sqlite.prepare('UPDATE sniffer_keys SET revoked_at = ? WHERE id = ?').run('2026-10-15T00:00:00.000Z', KEY_ID);
    expect((await call('POST', '/community-price/batch', batch([observation(RESOURCE)]))).status).toBe(401);
    expect((await call('GET', '/sniffer/config?build=3.7.10.10')).status).toBe(401);
  });

  it.each([
    ['a body that is not JSON', '{nope'],
    ['a missing build', batch([], { build: undefined })],
    ['a mappingId that is not an integer', batch([], { mappingId: '7' })],
    ['observations that are not an array', batch([], { observations: {} })],
  ])('refuses %s (400)', async (_, body) => {
    const response = await call('POST', '/community-price/batch', body);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'invalid_body' });
  });

  it('refuses a server outside the list (400), the manual form still accepts it', async () => {
    const response = await call('POST', '/community-price/batch', batch([observation(RESOURCE)], { serverId: 'nowhere' }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'unknown_server' });
    expect(contributions()).toEqual([]);

    expect(parseContributionPayload({ resourceId: RESOURCE, serverId: 'nowhere', amountKamas: 100, deviceId: 'd' })).toMatchObject({ serverId: 'nowhere' });
  });
});

describe('GET /sniffer/config (specs/056, US3)', () => {
  it('serves the minimum version, the link, the servers and the active mapping of the build', async () => {
    const response = await call('GET', '/sniffer/config?build=3.7.10.10&tool=0.1.0');
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      minVersion: '0.2.0',
      downloadUrl: 'https://example.test/releases/latest',
      servers: SERVERS,
      mapping: { id: 7, build: '3.7.10.10', keymap: { price_list: 'abc' }, schema: { fields: [1] }, provisional: false },
    });
    expect(SERVERS).toHaveLength(13);
    expect(SERVERS).toContain('mikhal');
  });

  it('serves no mapping for a build without an active one', async () => {
    const body = await (await call('GET', '/sniffer/config?build=3.8.0.0')).json() as { mapping: unknown };
    expect(body.mapping).toBeNull();
  });

  it('requires the build (400) and a key (401)', async () => {
    expect((await call('GET', '/sniffer/config')).status).toBe(400);
    expect((await call('GET', '/sniffer/config?build=3.7.10.10', undefined, null)).status).toBe(401);
  });

  it('falls back to defaults when the variables are not set', async () => {
    delete env.SNIFFER_MIN_VERSION;
    delete env.SNIFFER_DOWNLOAD_URL;
    const body = await (await call('GET', '/sniffer/config?build=3.7.10.10')).json() as { minVersion: string; downloadUrl: string };
    expect(body).toMatchObject({ minVersion: '0.0.0', downloadUrl: '' });
  });
});

describe('guards (specs/056, US4)', () => {
  it.each([
    ['older than the minimum', '0.1.9'],
    ['absent', undefined],
    ['unreadable', 'v0.3'],
  ])('refuses a tool %s (426)', async (_, tool) => {
    const response = await call('POST', '/community-price/batch', batch([observation(RESOURCE)], { tool }));
    expect(response.status).toBe(426);
    await expect(response.json()).resolves.toEqual({ error: 'tool_outdated', minVersion: '0.2.0', downloadUrl: 'https://example.test/releases/latest' });
    expect(contributions()).toEqual([]);
  });

  it('compares versions number by number', () => {
    expect(isToolOutdated('0.10.0', '0.9.0')).toBe(false);
    expect(isToolOutdated('0.2.0', '0.2.0')).toBe(false);
    expect(isToolOutdated('1.0.0', '0.2.0')).toBe(false);
    expect(isToolOutdated('0.1.10', '0.2.0')).toBe(true);
  });

  it('refuses a mapping that is no longer the active one, or a build without one (409)', async () => {
    const stale = await call('POST', '/community-price/batch', batch([observation(RESOURCE)], { mappingId: 6 }));
    expect(stale.status).toBe(409);
    await expect(stale.json()).resolves.toEqual({ error: 'mapping_not_active', activeMappingId: 7 });

    const unknown = await call('POST', '/community-price/batch', batch([observation(RESOURCE)], { build: '3.8.0.0' }));
    expect(unknown.status).toBe(409);
    await expect(unknown.json()).resolves.toEqual({ error: 'mapping_not_active', activeMappingId: null });
    expect(contributions()).toEqual([]);
  });

  it(`refuses more than ${MAX_BATCH_OBSERVATIONS} observations (400)`, async () => {
    const response = await call('POST', '/community-price/batch', batch(Array.from({ length: MAX_BATCH_OBSERVATIONS + 1 }, () => observation(RESOURCE))));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'too_many_observations', max: MAX_BATCH_OBSERVATIONS });
  });

  it('refuses a whole batch that would cross the daily cap (429), and accepts one that reaches it', async () => {
    const day = new Date().toISOString().slice(0, 10);
    test.sqlite.prepare('INSERT INTO sniffer_daily_usage (key_id, day, rows_written) VALUES (?, ?, ?)').run(KEY_ID, day, DAILY_ROW_LIMIT - 1);

    const over = await call('POST', '/community-price/batch', batch([observation(RESOURCE), observation(OTHER_RESOURCE)]));
    expect(over.status).toBe(429);
    await expect(over.json()).resolves.toEqual({ error: 'daily_limit', limit: DAILY_ROW_LIMIT, used: DAILY_ROW_LIMIT - 1 });
    expect(contributions()).toEqual([]);

    // Refused observations don't count against the cap.
    const last = await call('POST', '/community-price/batch', batch([observation(RESOURCE), observation(EQUIPMENT)]));
    await expect(last.json()).resolves.toEqual({ accepted: 1, rejected: [{ index: 1, reason: 'not_an_ingredient' }] });
    expect(usage()).toEqual([{ key_id: KEY_ID, day, rows_written: DAILY_ROW_LIMIT }]);
    expect((await call('POST', '/community-price/batch', batch([observation(RESOURCE)]))).status).toBe(429);
  });
});

describe('lot prices of a batch (specs/059-prix-par-lot, H1)', () => {
  const lots = (resource = RESOURCE) => test.sqlite.prepare(
    'SELECT lot_size, lot_price_kamas, device_id FROM community_price_lots WHERE resource_id = ? AND server_id = ? ORDER BY lot_size',
  ).all(resource, 'mikhal');

  it('keeps the price of each lot on sale, as sent, and leaves the single unit price untouched', async () => {
    await call('POST', '/community-price/batch', batch([observation(RESOURCE, { 1: 100, 10: 900, 100: 8_000, 1000: 0 })]));
    expect(lots()).toEqual([
      { lot_size: 1, lot_price_kamas: 100, device_id: KEY_ID },
      { lot_size: 10, lot_price_kamas: 900, device_id: KEY_ID },
      { lot_size: 100, lot_price_kamas: 8_000, device_id: KEY_ID },
    ]);
    expect(contributions()).toHaveLength(1);
  });

  it('replaces a lot price on a new observation and removes the lots no longer on sale', async () => {
    await call('POST', '/community-price/batch', batch([observation(RESOURCE, { 1: 100, 10: 900, 100: 8_000 })]));
    await call('POST', '/community-price/batch', batch([observation(RESOURCE, { 1: 120, 100: 7_500 })]));
    expect(lots()).toEqual([
      { lot_size: 1, lot_price_kamas: 120, device_id: KEY_ID },
      { lot_size: 100, lot_price_kamas: 7_500, device_id: KEY_ID },
    ]);
  });

  it('writes nothing for a refused observation, and keeps servers apart', async () => {
    await call('POST', '/community-price/batch', batch([observation(EQUIPMENT, { 1: 5 }), observation(RESOURCE, { 1: 100 })]));
    await call('POST', '/community-price/batch', batch([observation(RESOURCE, { 1: 999 })], { serverId: 'dakal' }));
    expect(lots(EQUIPMENT)).toEqual([]);
    expect(lots()).toEqual([{ lot_size: 1, lot_price_kamas: 100, device_id: KEY_ID }]);
  });
});

describe('provisional mapping after a client update (specs/070-sniffer-mapping-provisoire)', () => {
  const NEW_BUILD = '3.7.12.12';
  const upload = (id: number, build: string, uploadedAt: string, active = 1) => test.sqlite.prepare(
    'INSERT INTO sniffer_mappings (id, build, keymap_json, schema_json, uploaded_at, active) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, build, `{"price_list":"m${id}"}`, '{}', uploadedAt, active);
  const config = async (query: string) => ((await (await call('GET', `/sniffer/config?${query}`)).json()) as { mapping: unknown }).mapping;

  beforeEach(() => {
    test.sqlite.prepare("UPDATE sniffer_mappings SET uploaded_at = '2026-10-12T00:00:00.000Z'").run();
    upload(8, '3.7.9.9', '2026-10-01T00:00:00.000Z'); // active, but older than 7
    upload(9, '3.7.11.0', '2026-10-20T00:00:00.000Z', 0); // newest, but retired
  });

  it('serves the newest active mapping, with its own build, to a tool that asks for it', async () => {
    await expect(config(`build=${NEW_BUILD}&tool=0.4.0&provisional=1`)).resolves.toEqual(
      { id: 7, build: '3.7.10.10', keymap: { price_list: 'abc' }, schema: { fields: [1] }, provisional: true },
    );
  });

  it('breaks a tie on the upload time with the highest id', async () => {
    upload(10, '3.7.9.9b', '2026-10-12T00:00:00.000Z');
    await expect(config(`build=${NEW_BUILD}&provisional=1`)).resolves.toMatchObject({ id: 10, provisional: true });
  });

  it('serves no mapping to a tool that does not ask for one', async () => {
    await expect(config(`build=${NEW_BUILD}`)).resolves.toBeNull();
    await expect(config(`build=${NEW_BUILD}&provisional=true`)).resolves.toBeNull();
  });

  it('serves no mapping when none is active anywhere', async () => {
    test.sqlite.prepare('UPDATE sniffer_mappings SET active = 0').run();
    await expect(config(`build=${NEW_BUILD}&provisional=1`)).resolves.toBeNull();
  });

  it('prefers the mapping of the build over the fallback', async () => {
    upload(11, NEW_BUILD, '2026-10-01T00:00:00.000Z');
    await expect(config(`build=${NEW_BUILD}&provisional=1`)).resolves.toEqual(
      { id: 11, build: NEW_BUILD, keymap: { price_list: 'm11' }, schema: {}, provisional: false },
    );
  });

  it('accepts a provisional batch decoded with the fallback', async () => {
    const response = await call('POST', '/community-price/batch', batch([observation(RESOURCE)], { build: NEW_BUILD, mappingId: 7, provisional: true }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ accepted: 1, rejected: [] });
    expect(contributions()).toHaveLength(1);
  });

  it('refuses a provisional batch once the build has its own mapping (409), and the stale fallback id', async () => {
    upload(11, NEW_BUILD, '2026-10-22T00:00:00.000Z');
    const published = await call('POST', '/community-price/batch', batch([observation(RESOURCE)], { build: NEW_BUILD, mappingId: 7, provisional: true }));
    expect(published.status).toBe(409);
    await expect(published.json()).resolves.toEqual({ error: 'mapping_not_active', activeMappingId: 11 });

    test.sqlite.prepare('UPDATE sniffer_mappings SET active = 0 WHERE id = 11').run();
    upload(12, '3.7.11.5', '2026-10-22T01:00:00.000Z'); // a newer fallback replaces 7
    const stale = await call('POST', '/community-price/batch', batch([observation(RESOURCE)], { build: NEW_BUILD, mappingId: 7, provisional: true }));
    expect(stale.status).toBe(409);
    await expect(stale.json()).resolves.toEqual({ error: 'mapping_not_active', activeMappingId: 12 });
    expect(contributions()).toEqual([]);
  });

  it.each([
    ['without the flag', {}],
    ['with a flag that is not true', { provisional: 'true' }],
  ])('refuses a batch for a build without a mapping %s (409)', async (_, fields) => {
    const response = await call('POST', '/community-price/batch', batch([observation(RESOURCE)], { build: NEW_BUILD, mappingId: 7, ...fields }));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'mapping_not_active', activeMappingId: null });
    expect(contributions()).toEqual([]);
  });

  it('never writes a mapping from the public routes', async () => {
    const before = test.sqlite.prepare('SELECT * FROM sniffer_mappings ORDER BY id').all();
    await call('GET', `/sniffer/config?build=${NEW_BUILD}&provisional=1`);
    await call('POST', '/community-price/batch', batch([observation(RESOURCE)], { build: NEW_BUILD, mappingId: 7, provisional: true }));
    expect(test.sqlite.prepare('SELECT * FROM sniffer_mappings ORDER BY id').all()).toEqual(before);
  });
});
