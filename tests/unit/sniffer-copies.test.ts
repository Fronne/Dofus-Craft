import { beforeEach, describe, expect, it } from 'vitest';
import { sha256Hex } from '../../worker/src/fm/http';
import { COPY_DAILY_LIMIT, MAX_COPIES_PER_OBSERVATION, parseCopies } from '../../worker/src/listings';
import { handleSniffer, type SnifferEnv } from '../../worker/src/sniffer';
import { createTestD1 } from '../support/sqlite-d1';

// specs/078-bons-plans-hdv (contracts/sniffer-copies.md): the `copies` of an equipment observation.
const KEY = 'friend-key';
const KEY_ID = 'key-1';
const EQUIPMENT_CATEGORY = 9;
const RESOURCE_CATEGORY = 78;

let test: ReturnType<typeof createTestD1>;
let env: SnifferEnv;

beforeEach(async () => {
  test = createTestD1();
  env = { DB: test.d1, SNIFFER_MIN_VERSION: '0.2.0', SNIFFER_DOWNLOAD_URL: 'https://example.test/latest' };
  test.sqlite.prepare('INSERT INTO sniffer_keys (id, label, key_hash) VALUES (?, ?, ?)').run(KEY_ID, 'Ami', await sha256Hex(KEY));
  test.sqlite.prepare(`INSERT INTO sniffer_mappings (id, build, keymap_json, schema_json, active) VALUES (7, '3.7.10.10', '{}', '{}', 1)`).run();
});

async function send(observations: unknown[]) {
  const url = new URL('https://api.test/community-price/batch');
  const body = { tool: '0.2.0', build: '3.7.10.10', mappingId: 7, serverId: 'mikhal', observations };
  const result = await handleSniffer(new Request(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` }, body: JSON.stringify(body),
  }), url, env);
  return { status: result!.status, body: result!.body as Record<string, unknown> };
}

const copy = (listingId: string, price: number, stats: unknown = [{ effectId: 125, value: 40 }]) => ({ listingId, price, stats });
const equipment = (itemId: string, copies: unknown, extra: Record<string, unknown> = {}) =>
  ({ itemId, seenAt: '2026-10-31T10:00:00Z', category: EQUIPMENT_CATEGORY, lots: { 1: 100_000 }, copies, ...extra });

const listings = () => test.sqlite.prepare(
  'SELECT server_id, listing_id, item_id, price_kamas, stats_json, key_id FROM hdv_listings ORDER BY listing_id',
).all() as { server_id: string; listing_id: string; item_id: string; price_kamas: number; stats_json: string; key_id: string }[];

describe('copies of an equipment observation', () => {
  it('stores each copy with its price and stats, and still records the cheapest price', async () => {
    const response = await send([equipment('2423', [copy('101', 120_000), copy('102', 100_000, [{ effectId: 125, value: 38 }, { effectId: 118, value: 20 }])])]);
    expect(response).toEqual({ status: 200, body: { accepted: 1, rejected: [] } });
    expect(listings()).toEqual([
      { server_id: 'mikhal', listing_id: '101', item_id: '2423', price_kamas: 120_000, stats_json: '[{"effectId":125,"value":40}]', key_id: KEY_ID },
      { server_id: 'mikhal', listing_id: '102', item_id: '2423', price_kamas: 100_000, stats_json: '[{"effectId":125,"value":38},{"effectId":118,"value":20}]', key_id: KEY_ID },
    ]);
    const price = test.sqlite.prepare(`SELECT amount_kamas FROM community_price_contributions WHERE kind = 'item'`).get() as { amount_kamas: number };
    expect(price.amount_kamas).toBe(100_000);
  });

  it('leaves the listings alone for an observation without copies (an older tool)', async () => {
    await send([equipment('2423', [copy('101', 120_000)])]);
    const { copies: _copies, ...withoutCopies } = equipment('2423', []);
    expect(await send([withoutCopies])).toEqual({ status: 200, body: { accepted: 1, rejected: [] } });
    expect(listings()).toHaveLength(1);
  });

  it('replaces the listings of the item: updates the known, adds the new, drops the vanished', async () => {
    await send([equipment('2423', [copy('101', 120_000), copy('102', 100_000)])]);
    test.sqlite.prepare(`UPDATE hdv_listings SET first_seen_at = '2026-10-30T00:00:00.000Z' WHERE listing_id = '101'`).run();
    await send([equipment('2423', [copy('101', 110_000), copy('103', 90_000)])]);
    expect(listings().map((row) => [row.listing_id, row.price_kamas])).toEqual([['101', 110_000], ['103', 90_000]]);
    const first = test.sqlite.prepare(`SELECT first_seen_at FROM hdv_listings WHERE listing_id = '101'`).get() as { first_seen_at: string };
    expect(first.first_seen_at).toBe('2026-10-30T00:00:00.000Z');
  });

  it('does not drop what another key saw, nor anything after a lot cut at the maximum', async () => {
    test.sqlite.prepare(
      `INSERT INTO hdv_listings (server_id, listing_id, item_id, price_kamas, stats_json, first_seen_at, last_seen_at, key_id)
       VALUES ('mikhal', '900', '2423', 5, '[]', 'x', 'x', 'someone-else')`,
    ).run();
    await send([equipment('2423', [copy('101', 120_000)])]);
    expect(listings().map((row) => row.listing_id)).toEqual(['101', '900']);
    const full = Array.from({ length: MAX_COPIES_PER_OBSERVATION }, (_, i) => copy(String(2000 + i), 10));
    await send([equipment('2423', [copy('101', 120_000)])]);
    await send([equipment('2423', full)]);
    expect(listings().map((row) => row.listing_id)).toContain('101');
  });

  it('does not touch the listings of another item or server', async () => {
    await send([equipment('2423', [copy('101', 120_000)]), equipment('2500', [copy('201', 50_000)])]);
    await send([equipment('2423', [copy('102', 90_000)])]);
    expect(listings().map((row) => row.listing_id)).toEqual(['102', '201']);
  });

  it('keeps one announcement when two keys saw the same copy', async () => {
    await send([equipment('2423', [copy('101', 120_000)])]);
    test.sqlite.prepare('INSERT INTO sniffer_keys (id, label, key_hash) VALUES (?, ?, ?)').run('key-2', 'Autre', await sha256Hex('other'));
    const url = new URL('https://api.test/community-price/batch');
    await handleSniffer(new Request(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer other' },
      body: JSON.stringify({ tool: '0.2.0', build: '3.7.10.10', mappingId: 7, serverId: 'mikhal', observations: [equipment('2423', [copy('101', 118_000)])] }),
    }), url, env);
    expect(listings()).toMatchObject([{ listing_id: '101', price_kamas: 118_000, key_id: 'key-2' }]);
  });

  it.each([
    ['on a resource', { ...equipment('746', [copy('1', 10)]), category: RESOURCE_CATEGORY, lots: { 1: 10 } }],
    ['without a category', { itemId: '2423', seenAt: '2026-10-31T10:00:00Z', lots: { 1: 100 }, copies: [copy('1', 10)] }],
    ['empty', equipment('2423', [])],
    ['with a duplicate listingId', equipment('2423', [copy('1', 10), copy('1', 20)])],
    ['with a price of 0', equipment('2423', [copy('1', 0)])],
    ['with a fractional price', equipment('2423', [copy('1', 10.5)])],
    ['with a non-numeric listingId', equipment('2423', [copy('abc', 10)])],
    ['without stats', equipment('2423', [copy('1', 10, [])])],
    ['with a bad stat', equipment('2423', [copy('1', 10, [{ effectId: 0, value: 3 }])])],
    ['with too many stats', equipment('2423', [copy('1', 10, Array.from({ length: 41 }, (_, i) => ({ effectId: i + 1, value: 1 })))])],
    ['with too many copies', equipment('2423', Array.from({ length: MAX_COPIES_PER_OBSERVATION + 1 }, (_, i) => copy(String(i + 1), 10)))],
  ])('refuses copies %s and stores nothing', async (_name, observation) => {
    const response = await send([observation]);
    expect(response.body.rejected).toEqual([{ index: 0, reason: 'invalid' }]);
    expect(listings()).toEqual([]);
  });

  it('counts the copies in their own daily cap, apart from the observations', async () => {
    await send([equipment('2423', [copy('1', 10), copy('2', 20), copy('3', 30)])]);
    const row = test.sqlite.prepare('SELECT rows_written, copies_written FROM sniffer_daily_usage').get();
    expect(row).toEqual({ rows_written: 1, copies_written: 3 });
  });

  it('refuses a batch whole when its copies would cross the copy cap', async () => {
    test.sqlite.prepare('INSERT INTO sniffer_daily_usage (key_id, day, rows_written, copies_written) VALUES (?, ?, 0, ?)')
      .run(KEY_ID, new Date().toISOString().slice(0, 10), COPY_DAILY_LIMIT - 1);
    const response = await send([equipment('2423', [copy('1', 10), copy('2', 20)])]);
    expect(response.status).toBe(429);
    expect(response.body).toMatchObject({ error: 'daily_limit', kind: 'copies', limit: COPY_DAILY_LIMIT });
    expect(listings()).toEqual([]);
  });
});

describe('parseCopies', () => {
  it('accepts a valid list and refuses anything else', () => {
    expect(parseCopies([copy('1', 10)])).toEqual([{ listingId: '1', price: 10, stats: [{ effectId: 125, value: 40 }] }]);
    expect(parseCopies('nope')).toBeUndefined();
    expect(parseCopies([null])).toBeUndefined();
  });
});
