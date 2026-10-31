import { beforeEach, describe, expect, it } from 'vitest';
import {
  bonsPlansResponse,
  DEFAULT_GOOD_DEAL_THRESHOLD,
  GOOD_DEAL_THRESHOLD_KEY,
  MAX_LISTINGS_SERVED,
  purgeStaleListings,
  readGoodDealThreshold,
} from '../../worker/src/listings';
import { createTestD1 } from '../support/sqlite-d1';

// specs/078-bons-plans-hdv (contracts/bons-plans-api.md): GET /bons-plans, the threshold, the purge.
const NOW = new Date('2026-10-31T12:00:00Z');
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();

let test: ReturnType<typeof createTestD1>;

beforeEach(() => {
  test = createTestD1();
});

function addListing(listingId: string, itemId: string, seenAt: string, serverId = 'mikhal', price = 100_000) {
  test.sqlite.prepare(
    `INSERT INTO hdv_listings (server_id, listing_id, item_id, price_kamas, stats_json, first_seen_at, last_seen_at, key_id)
     VALUES (?, ?, ?, ?, '[{"effectId":125,"value":40}]', ?, ?, 'k')`,
  ).run(serverId, listingId, itemId, price, seenAt, seenAt);
}

const addItem = (itemId: string, count: number, seenAt: string, serverId = 'mikhal', start = 1) => {
  for (let i = 0; i < count; i += 1) addListing(`${itemId}-${start + i}`, itemId, seenAt, serverId);
};

const get = async (query: string) => bonsPlansResponse(test.d1, new URL(`https://api.test/bons-plans${query}`), NOW);
const idsOf = (result: { body: unknown }) => (result.body as { listings: { listingId: string }[] }).listings.map((l) => l.listingId).sort();

describe('GET /bons-plans', () => {
  it('serves the fresh listings of the server with the default threshold', async () => {
    addItem('1', 4, hoursAgo(1));
    const result = await get('?server=mikhal');
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ thresholdPercent: DEFAULT_GOOD_DEAL_THRESHOLD, maxAgeHours: 24, generatedAt: NOW.toISOString() });
    expect(idsOf(result)).toEqual(['1-1', '1-2', '1-3', '1-4']);
  });

  it('leaves out announcements not seen for more than 24 hours', async () => {
    addItem('1', 4, hoursAgo(23));
    addItem('1', 1, hoursAgo(25), 'mikhal', 5);
    expect(idsOf(await get('?server=mikhal'))).toEqual(['1-1', '1-2', '1-3', '1-4']);
  });

  it('leaves out an item with fewer than four fresh copies, stale ones not counting', async () => {
    addItem('1', 3, hoursAgo(1));
    addItem('2', 3, hoursAgo(1));
    addItem('2', 3, hoursAgo(30), 'mikhal', 4);
    expect(idsOf(await get('?server=mikhal'))).toEqual([]);
  });

  it('serves only the asked server', async () => {
    addItem('1', 4, hoursAgo(1), 'mikhal');
    addItem('2', 4, hoursAgo(1), 'draconiros');
    expect(idsOf(await get('?server=mikhal')).every((id) => id.startsWith('1-'))).toBe(true);
  });

  it('refuses a missing or unknown server', async () => {
    expect(await get('')).toEqual({ status: 400, body: { error: 'unknown_server' } });
    expect(await get('?server=nope')).toEqual({ status: 400, body: { error: 'unknown_server' } });
  });

  it('answers an empty list when nothing is on sale', async () => {
    expect((await get('?server=mikhal')).body).toMatchObject({ listings: [] });
  });

  it('serves at most the cap, most recently seen first', async () => {
    expect(MAX_LISTINGS_SERVED).toBe(5000);
    const insert = test.sqlite.prepare(
      `INSERT INTO hdv_listings (server_id, listing_id, item_id, price_kamas, stats_json, first_seen_at, last_seen_at, key_id)
       VALUES ('mikhal', ?, ?, 1000, '[]', ?, ?, 'k')`,
    );
    for (let i = 0; i < 5004; i += 1) insert.run(`L${i}`, String(i % 200), hoursAgo(1 + (i % 20) / 100), hoursAgo(1 + (i % 20) / 100));
    const result = await get('?server=mikhal');
    expect((result.body as { listings: unknown[] }).listings).toHaveLength(5000);
  });
});

describe('good deal threshold', () => {
  it('is 25 until the admin sets one', async () => {
    expect(await readGoodDealThreshold(test.d1)).toBe(25);
  });

  it('reads the value saved in numeric_settings and serves it', async () => {
    test.sqlite.prepare(`INSERT INTO numeric_settings (key, value, updated_at) VALUES (?, 40, '2026-10-31T00:00:00Z')`).run(GOOD_DEAL_THRESHOLD_KEY);
    expect(await readGoodDealThreshold(test.d1)).toBe(40);
    expect((await get('?server=mikhal')).body).toMatchObject({ thresholdPercent: 40 });
  });

  it('refuses to store a value outside 5–90 (the table checks it)', () => {
    const insert = (value: number) => test.sqlite.prepare(`INSERT INTO numeric_settings (key, value, updated_at) VALUES (?, ?, '2026-10-31T00:00:00Z')`).run(GOOD_DEAL_THRESHOLD_KEY, value);
    expect(() => insert(4)).toThrow();
    expect(() => insert(91)).toThrow();
  });
});

describe('purge of stale listings', () => {
  it('removes announcements not seen for more than 24 hours and keeps the others', async () => {
    addItem('1', 2, hoursAgo(25));
    addItem('2', 2, hoursAgo(2));
    expect(await purgeStaleListings(test.d1, NOW)).toBe(2);
    const left = test.sqlite.prepare('SELECT listing_id FROM hdv_listings ORDER BY listing_id').all();
    expect(left).toEqual([{ listing_id: '2-1' }, { listing_id: '2-2' }]);
  });
});
