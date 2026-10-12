import { beforeEach, describe, expect, it } from 'vitest';
import { communityPricesResponse } from '../../worker/src/contribution';
import { readExternalPrices, withExternalPrice } from '../../worker/src/external-price';
import { itemPricesResponse, latestPriceResponse } from '../../worker/src/latest';
import { clearReadCache } from '../../worker/src/read-cache';
import { createTestD1 } from '../support/sqlite-d1';

// specs/045-restore-production-worker (US2): the prices read from Huzounet beside the group's own.
beforeEach(() => clearReadCache());

const summary = { medianAmountKamas: 100, sampleSize: 3, lastContributionAt: '2026-10-01T10:00:00.000Z', latestAmountKamas: 110, latestContributionAt: '2026-10-01T10:00:00.000Z', latestOrigin: 'manual' as const };
const external = { unitPriceKamas: 90, observedAt: '2026-10-02T10:00:00.000Z', provisional: false, stale: false };

function seed() {
  const test = createTestD1();
  const addExternal = (row: { resourceId: string; price: number; observedAt: string; serverId?: string; isItem?: boolean; provisional?: boolean; stale?: boolean }) =>
    test.sqlite.prepare(
      `INSERT INTO external_prices (source, resource_id, server_id, unit_price_kamas, observed_at, provisional, stale, fetched_at, is_item)
       VALUES ('huzounet', ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(row.resourceId, row.serverId ?? 'mikhal', row.price, row.observedAt, row.provisional ? 1 : 0, row.stale ? 1 : 0, row.observedAt, row.isItem ? 1 : 0);
  return { ...test, addExternal };
}

describe('withExternalPrice', () => {
  it('changes nothing without an external price', () => {
    expect(withExternalPrice(summary, undefined)).toBe(summary);
    expect(withExternalPrice(undefined, undefined)).toBeUndefined();
  });

  it('stands alone, without median or sample, when the group shared nothing', () => {
    expect(withExternalPrice(undefined, external)).toEqual({
      medianAmountKamas: 0, sampleSize: 0, latestAmountKamas: 90, latestContributionAt: '2026-10-02T10:00:00.000Z', latestOrigin: 'external',
    });
  });

  it('replaces the latest shared price only when it was observed after it', () => {
    expect(withExternalPrice(summary, external)).toEqual({ ...summary, latestAmountKamas: 90, latestContributionAt: '2026-10-02T10:00:00.000Z', latestOrigin: 'external' });
    expect(withExternalPrice(summary, { ...external, observedAt: '2026-09-30T10:00:00.000Z' })).toBe(summary);
  });

  it('says when its source calls the price old or provisional, old first', () => {
    expect(withExternalPrice(undefined, { ...external, provisional: true })).toMatchObject({ latestFragile: 'provisional' });
    expect(withExternalPrice(undefined, { ...external, provisional: true, stale: true })).toMatchObject({ latestFragile: 'stale' });
    expect(withExternalPrice(undefined, external)).not.toHaveProperty('latestFragile');
  });
});

describe('readExternalPrices', () => {
  it('reads the prices of the asked resources on the asked server only', async () => {
    const { d1, addExternal } = seed();
    addExternal({ resourceId: '1', price: 90, observedAt: '2026-10-02T10:00:00.000Z', stale: true });
    addExternal({ resourceId: '2', price: 50, observedAt: '2026-10-02T10:00:00.000Z' });
    addExternal({ resourceId: '1', price: 7, observedAt: '2026-10-02T10:00:00.000Z', serverId: 'dakal' });

    expect([...await readExternalPrices(d1, 'mikhal', ['1', '3'])]).toEqual([['1', { unitPriceKamas: 90, observedAt: '2026-10-02T10:00:00.000Z', provisional: false, stale: true }]]);
    expect((await readExternalPrices(d1, 'mikhal', [])).size).toBe(0);
  });
});

describe('the price reads, with external prices', () => {
  it('GET /community-prices gives a resource only Huzounet prices, and the most recent of both otherwise', async () => {
    const { d1, insert, addExternal } = seed();
    const recent = new Date(Date.now() - 86_400_000).toISOString();
    insert({ resourceId: '1', amountKamas: 100, createdAt: recent });
    addExternal({ resourceId: '1', price: 90, observedAt: new Date().toISOString() });
    addExternal({ resourceId: '2', price: 50, observedAt: recent, provisional: true });

    const { body } = await communityPricesResponse(d1, new URL('https://api.test/community-prices?serverId=mikhal&resourceIds=1,2,3'));
    const prices = (body as { prices: Record<string, unknown>[] }).prices;
    expect(prices).toHaveLength(2);
    expect(prices[0]).toMatchObject({ resourceId: '1', medianAmountKamas: 100, sampleSize: 1, latestAmountKamas: 90, latestOrigin: 'external' });
    expect(prices[1]).toMatchObject({ resourceId: '2', medianAmountKamas: 0, sampleSize: 0, latestAmountKamas: 50, latestOrigin: 'external', latestFragile: 'provisional' });
  });

  it('GET /latest-price gives the external price when it is the most recent, or the only one', async () => {
    const { d1, insert, addExternal } = seed();
    const url = (itemId: string) => new URL(`https://api.test/latest-price?itemId=${itemId}&serverId=mikhal`);
    insert({ resourceId: '44', amountKamas: 1200, createdAt: '2026-09-24T10:00:00.000Z', kind: 'item' });
    insert({ resourceId: '45', amountKamas: 5000, createdAt: '2026-09-24T10:00:00.000Z', kind: 'item' });
    addExternal({ resourceId: '44', price: 1100, observedAt: '2026-09-25T10:00:00.000Z' });
    addExternal({ resourceId: '45', price: 4000, observedAt: '2026-09-20T10:00:00.000Z' });
    addExternal({ resourceId: '46', price: 300, observedAt: '2026-09-20T10:00:00.000Z' });

    expect((await latestPriceResponse(d1, url('44'))).body).toMatchObject({ amountKamas: 1100, contributedAt: '2026-09-25T10:00:00.000Z' });
    expect((await latestPriceResponse(d1, url('45'))).body).toMatchObject({ amountKamas: 5000 });
    expect((await latestPriceResponse(d1, url('46'))).body).toMatchObject({ amountKamas: 300 });
    expect((await latestPriceResponse(d1, url('47'))).status).toBe(404);
  });

  it('GET /item-prices adds the external prices of items players look at, the most recent winning', async () => {
    const { d1, insert, addExternal } = seed();
    insert({ resourceId: '44', amountKamas: 1200, createdAt: '2026-09-24T10:00:00.000Z', kind: 'item' });
    insert({ resourceId: '45', amountKamas: 5000, createdAt: '2026-09-24T10:00:00.000Z', kind: 'item' });
    addExternal({ resourceId: '44', price: 1100, observedAt: '2026-09-25T10:00:00.000Z', isItem: true });
    addExternal({ resourceId: '45', price: 4000, observedAt: '2026-09-20T10:00:00.000Z', isItem: true });
    addExternal({ resourceId: '46', price: 300, observedAt: '2026-09-20T10:00:00.000Z', isItem: true });
    // The price of an ingredient, or of another server, is not an item's price.
    addExternal({ resourceId: '47', price: 10, observedAt: '2026-09-20T10:00:00.000Z' });
    addExternal({ resourceId: '48', price: 10, observedAt: '2026-09-20T10:00:00.000Z', serverId: 'dakal', isItem: true });

    const { body } = await itemPricesResponse(d1, new URL('https://api.test/item-prices?serverId=mikhal'));
    const items = (body as { items: { itemId: string; amountKamas: number }[] }).items;
    expect(items.map((item) => [item.itemId, item.amountKamas]).sort()).toEqual([['44', 1100], ['45', 5000], ['46', 300]]);
  });
});
