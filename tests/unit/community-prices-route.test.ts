import { beforeEach, describe, expect, it, vi } from 'vitest';
import { communityPricesResponse, fetchCurrentMedian } from '../../worker/src/contribution';
import { cachedRead, clearReadCache } from '../../worker/src/read-cache';
import { createTestD1 } from '../support/sqlite-d1';

// specs/021-background-data-loading, contracts/community-prices.md.
const recent = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();
const url = (query: string) => new URL(`https://api.test/community-prices?${query}`);

function seed() {
  const test = createTestD1();
  test.insert({ resourceId: '1', amountKamas: 100, createdAt: recent(3), deviceId: 'a' });
  test.insert({ resourceId: '1', amountKamas: 300, createdAt: recent(2), deviceId: 'b' });
  test.insert({ resourceId: '1', amountKamas: 200, createdAt: recent(1), deviceId: 'c' });
  test.insert({ resourceId: '2', amountKamas: 50, createdAt: recent(1), deviceId: 'a' });
  test.insert({ resourceId: '2', amountKamas: 9999, createdAt: recent(1), serverId: 'dakal', deviceId: 'a' });
  return test;
}

beforeEach(() => clearReadCache());

describe('GET /community-prices', () => {
  it('gives each resource the same median as the one-by-one read, and omits resources without one', async () => {
    const { d1 } = seed();
    const { status, body } = await communityPricesResponse(d1, url('serverId=mikhal&resourceIds=1,2,3,1'));

    expect(status).toBe(200);
    const one = await fetchCurrentMedian(d1, '1', 'mikhal');
    const two = await fetchCurrentMedian(d1, '2', 'mikhal');
    expect(body).toEqual({
      serverId: 'mikhal',
      prices: [{ resourceId: '1', ...one }, { resourceId: '2', ...two }],
    });
  });

  it('gives each resource its latest contribution and date (specs/024)', async () => {
    const { d1 } = seed();
    const { body } = await communityPricesResponse(d1, url('serverId=mikhal&resourceIds=1,2'));
    const prices = (body as { prices: { resourceId: string; medianAmountKamas: number; latestAmountKamas: number; latestContributionAt: string }[] }).prices;

    expect(prices[0]).toMatchObject({ resourceId: '1', medianAmountKamas: 200, latestAmountKamas: 200 });
    expect(prices[1]).toMatchObject({ resourceId: '2', latestAmountKamas: 50 });
    expect(await fetchCurrentMedian(d1, '1', 'mikhal')).toMatchObject({ latestAmountKamas: 200, latestContributionAt: prices[0].latestContributionAt });
  });

  it('breaks a tie on the date by recording order (specs/024)', async () => {
    const { d1, insert } = createTestD1();
    const at = recent(1);
    insert({ resourceId: '1', amountKamas: 120, createdAt: at, deviceId: 'a' });
    insert({ resourceId: '1', amountKamas: 100, createdAt: at, deviceId: 'b' });

    expect(await fetchCurrentMedian(d1, '1', 'mikhal')).toMatchObject({ latestAmountKamas: 100 });
  });

  it('answers 400 without a server, without ids, or with more than 98 ids', async () => {
    const { d1 } = createTestD1();
    const tooMany = Array.from({ length: 99 }, (_, index) => index).join(',');

    expect((await communityPricesResponse(d1, url('resourceIds=1'))).status).toBe(400);
    expect((await communityPricesResponse(d1, url('serverId=mikhal&resourceIds='))).status).toBe(400);
    expect((await communityPricesResponse(d1, url(`serverId=mikhal&resourceIds=${tooMany}`))).status).toBe(400);
  });
});

describe('read cache (FR-012, FR-013)', () => {
  const read = (d1: Parameters<typeof communityPricesResponse>[0], query: string) =>
    cachedRead(url(query), () => communityPricesResponse(d1, url(query)));

  it('marks price reads cacheable for 60 seconds and serves the second read without the database', async () => {
    const { d1 } = seed();
    const prepare = vi.spyOn(d1, 'prepare');

    const first = await read(d1, 'serverId=mikhal&resourceIds=1');
    const second = await read(d1, 'resourceIds=1&serverId=mikhal');

    expect(first.headers['Cache-Control']).toBe('public, max-age=60');
    expect(second.body).toEqual(first.body);
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it('reads the database again with fresh=1, marked no-store', async () => {
    const { d1, insert } = seed();
    await read(d1, 'serverId=mikhal&resourceIds=2');
    insert({ resourceId: '2', amountKamas: 70, createdAt: recent(0), deviceId: 'z' });

    const fresh = await read(d1, 'serverId=mikhal&resourceIds=2&fresh=1');

    expect(fresh.headers['Cache-Control']).toBe('no-store');
    expect((fresh.body as { prices: { sampleSize: number }[] }).prices[0].sampleSize).toBe(2);
  });

  it('reads the database again once the cache is cleared (after a contribution)', async () => {
    const { d1, insert } = seed();
    await read(d1, 'serverId=mikhal&resourceIds=2');
    insert({ resourceId: '2', amountKamas: 60, createdAt: recent(0), deviceId: 'y' });
    clearReadCache();

    const after = await read(d1, 'serverId=mikhal&resourceIds=2');

    expect((after.body as { prices: { sampleSize: number }[] }).prices[0].sampleSize).toBe(2);
  });

  it('never caches an error answer', async () => {
    const { d1 } = createTestD1();

    expect((await read(d1, 'serverId=mikhal')).headers).toEqual({});
  });
});
