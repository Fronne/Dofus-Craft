import { beforeEach, describe, expect, it } from 'vitest';
import { communityPricesResponse, fetchCurrentMedian, insertContribution, parseContributionPayload } from '../../worker/src/contribution';
import { clearReadCache } from '../../worker/src/read-cache';
import { createTestD1 } from '../support/sqlite-d1';

// specs/025-rune-purchase-import (FR-011, research R7): every shared price keeps its origin, and the
// reads give the origin of the latest one.
const recent = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();

beforeEach(() => clearReadCache());

describe('contribution origin', () => {
  it('records a price posted by the public route as a manual entry, whatever the body claims', async () => {
    const { d1 } = createTestD1();
    const contribution = parseContributionPayload({ resourceId: '1', serverId: 'mikhal', amountKamas: 100, deviceId: 'device-a', origin: 'bot' });
    expect(contribution?.origin).toBe('manual');
    await insertContribution(d1, contribution!);
    const stored = await d1.prepare('SELECT origin FROM community_price_contributions').first<{ origin: string }>();
    expect(stored?.origin).toBe('manual');
  });

  it('records the origin given by the Forgemagie routes', async () => {
    const { d1 } = createTestD1();
    const contribution = parseContributionPayload({ resourceId: '1', serverId: 'mikhal', amountKamas: 1587, deviceId: 'fm:abc' })!;
    await insertContribution(d1, { ...contribution, origin: 'bot' });
    const stored = await d1.prepare('SELECT origin FROM community_price_contributions').first<{ origin: string }>();
    expect(stored?.origin).toBe('bot');
  });

  it('gives the origin of the latest contribution in both reads', async () => {
    const { d1, insert } = createTestD1();
    insert({ resourceId: '1', amountKamas: 100, createdAt: recent(2), deviceId: 'a', origin: 'manual' });
    insert({ resourceId: '1', amountKamas: 120, createdAt: recent(1), deviceId: 'b', origin: 'bot' });
    insert({ resourceId: '2', amountKamas: 50, createdAt: recent(1), deviceId: 'a', origin: 'capture' });

    // GET /community-price answers with fetchCurrentMedian's summary (worker/src/index.ts).
    expect(await fetchCurrentMedian(d1, '1', 'mikhal')).toMatchObject({ latestAmountKamas: 120, latestOrigin: 'bot' });

    const { body } = await communityPricesResponse(d1, new URL('https://api.test/community-prices?serverId=mikhal&resourceIds=1,2'));
    expect((body as { prices: { resourceId: string; latestOrigin: string }[] }).prices.map((price) => [price.resourceId, price.latestOrigin]))
      .toEqual([['1', 'bot'], ['2', 'capture']]);
  });
});
