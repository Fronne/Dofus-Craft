import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

// specs/072-classement-brisage (T004): the rune prices of the Brisage page, now with the date of each price.
const getCommunityPrices = vi.fn();
vi.mock('../../src/services/community-price-api', () => ({
  getCommunityPrices: (...args: unknown[]) => getCommunityPrices(...args),
}));

import { loadRunePriceDetails } from '../../src/features/brisage/useRunePrices';
import { resourcePricesFor } from '../../src/persistence/resource-prices-for-mode';

describe('loadRunePriceDetails', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    getCommunityPrices.mockReset();
  });

  it('gives the carnet price and its date in the personal mode', async () => {
    await resourcePricesFor('personal').save('mikhal', '1523', 5, '2026-10-20T10:00:00.000Z');
    const { prices, communityUnavailable } = await loadRunePriceDetails('mikhal', 'personal', ['1523', '1525']);
    expect(prices).toEqual({ '1523': { unitPriceKamas: 5, updatedAt: '2026-10-20T10:00:00.000Z' } });
    expect(communityUnavailable).toBe(false);
    expect(getCommunityPrices).not.toHaveBeenCalled();
  });

  it('lets a more recent shared price replace an older carnet entry, with the shared date', async () => {
    await resourcePricesFor('community').save('mikhal', '1523', 5, '2026-10-20T10:00:00.000Z');
    getCommunityPrices.mockResolvedValue({
      status: 'found',
      prices: [{ resourceId: '1523', serverId: 'mikhal', medianAmountKamas: 7, sampleSize: 3, latestAmountKamas: 8, latestContributionAt: '2026-10-22T09:00:00.000Z' }],
    });
    const { prices } = await loadRunePriceDetails('mikhal', 'community', ['1523']);
    expect(prices['1523']).toEqual({ unitPriceKamas: 8, updatedAt: '2026-10-22T09:00:00.000Z' });
  });

  it('keeps the carnet prices and says so when the shared prices are unavailable', async () => {
    await resourcePricesFor('community').save('mikhal', '1523', 5, '2026-10-20T10:00:00.000Z');
    getCommunityPrices.mockResolvedValue({ status: 'unavailable' });
    const { prices, communityUnavailable } = await loadRunePriceDetails('mikhal', 'community', ['1523']);
    expect(prices['1523']?.unitPriceKamas).toBe(5);
    expect(communityUnavailable).toBe(true);
  });
});
