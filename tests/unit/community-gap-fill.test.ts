import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommunityPrice } from '../../src/domain/types';

const lookupCommunityPrice = vi.fn<(resourceId: string, serverId: string) => Promise<CommunityPrice | undefined>>();
vi.mock('../../src/features/comparison/useCommunityPrice', () => ({
  lookupCommunityPrice: (resourceId: string, serverId: string) => lookupCommunityPrice(resourceId, serverId),
}));

import { syncCommunityPrices } from '../../src/features/comparison/community-gap-fill';

// specs/024-latest-community-price (FR-004, FR-005, FR-007), research.md §5.
const shared = (resourceId: string, latestAmountKamas: number, latestContributionAt: string): CommunityPrice => ({
  resourceId, serverId: 'mikhal', medianAmountKamas: 1, sampleSize: 1, latestAmountKamas, latestContributionAt,
});
const kept = (resourceId: string, unitPriceKamas: number, updatedAt: string) => ({ resourceId, unitPriceKamas, updatedAt });

describe('syncCommunityPrices', () => {
  beforeEach(() => lookupCommunityPrice.mockReset());

  it('replaces an older kept price, fills a missing one, keeps a more recent one, and leaves a resource without shared price', async () => {
    const byId: Record<string, CommunityPrice | undefined> = {
      old: shared('old', 1848, '2026-09-28T13:51:28.940Z'),
      missing: shared('missing', 50, '2026-09-27T10:00:00.000Z'),
      recent: shared('recent', 90, '2026-09-20T10:00:00.000Z'),
      none: undefined,
    };
    lookupCommunityPrice.mockImplementation(async (resourceId) => byId[resourceId]);
    const prices = {
      old: kept('old', 1437, '2026-09-22T14:39:01.772Z'),
      recent: kept('recent', 100, '2026-09-25T10:00:00.000Z'),
    };
    const save = vi.fn(async () => undefined);

    const saved = await syncCommunityPrices('mikhal', ['old', 'missing', 'recent', 'none'], prices, save, () => false);

    expect(saved).toBe(true);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenCalledWith('old', 1848, '2026-09-28T13:51:28.940Z');
    expect(save).toHaveBeenCalledWith('missing', 50, '2026-09-27T10:00:00.000Z');
    expect(prices).toMatchObject({
      old: { unitPriceKamas: 1848, updatedAt: '2026-09-28T13:51:28.940Z' },
      missing: { unitPriceKamas: 50 },
      recent: { unitPriceKamas: 100 },
    });
    expect(prices).not.toHaveProperty('none');
  });

  it('writes nothing once cancelled', async () => {
    lookupCommunityPrice.mockResolvedValue(shared('a', 10, '2026-09-28T10:00:00.000Z'));
    const save = vi.fn(async () => undefined);

    expect(await syncCommunityPrices('mikhal', ['a'], {}, save, () => true)).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it('reads every resource in the same tick, so the reads leave grouped', async () => {
    lookupCommunityPrice.mockResolvedValue(undefined);
    const pending = syncCommunityPrices('mikhal', ['a', 'b', 'c', 'a'], {}, vi.fn(), () => false);

    expect(lookupCommunityPrice).toHaveBeenCalledTimes(3);
    await pending;
  });
});
