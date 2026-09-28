import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCommunityPrice, getCommunityPrices, getLatestItemPrice, submitCommunityPrice } from '../../src/services/community-price-api';

describe('community price API service (Cloudflare Worker client)', () => {
  beforeEach(() => vi.restoreAllMocks());

  describe('getCommunityPrice', () => {
    it('resolves a found price, with its latest contribution, from a successful response', async () => {
      const price = {
        resourceId: 'r1', serverId: 's1', medianAmountKamas: 1200, sampleSize: 4,
        latestAmountKamas: 1100, latestContributionAt: '2026-09-28T13:51:28.940Z',
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(price), { status: 200 })));

      await expect(getCommunityPrice('r1', 's1')).resolves.toEqual({ status: 'found', price });
    });

    it('resolves unavailable when the answer has no latest price (specs/024)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(
        { resourceId: 'r1', serverId: 's1', medianAmountKamas: 1200, sampleSize: 4 },
      ), { status: 200 })));

      await expect(getCommunityPrice('r1', 's1')).resolves.toEqual({ status: 'unavailable' });
    });

    it('does the same for a batched read (specs/024)', async () => {
      const complete = { resourceId: 'r1', serverId: 's1', medianAmountKamas: 1200, sampleSize: 4, latestAmountKamas: 1100, latestContributionAt: '2026-09-28T13:51:28.940Z' };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ serverId: 's1', prices: [complete] }), { status: 200 })));
      await expect(getCommunityPrices(['r1'], 's1')).resolves.toEqual({ status: 'found', prices: [complete] });

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(
        { serverId: 's1', prices: [{ resourceId: 'r1', serverId: 's1', medianAmountKamas: 1200, sampleSize: 4 }] },
      ), { status: 200 })));
      await expect(getCommunityPrices(['r1'], 's1')).resolves.toEqual({ status: 'unavailable' });
    });

    it('resolves not-found on a 404 response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('null', { status: 404 })));

      await expect(getCommunityPrice('r1', 's1')).resolves.toEqual({ status: 'not-found' });
    });

    it('resolves unavailable rather than throwing on a network error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

      await expect(getCommunityPrice('r1', 's1')).resolves.toEqual({ status: 'unavailable' });
    });

    it('resolves unavailable on an unexpected non-ok HTTP status', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })));

      await expect(getCommunityPrice('r1', 's1')).resolves.toEqual({ status: 'unavailable' });
    });
  });

  describe('submitCommunityPrice', () => {
    beforeEach(() => window.localStorage.clear());

    it('sends resourceId/serverId/amountKamas plus an anonymous deviceId, never any personally identifying data (revision 5)', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'contribution-1' }), { status: 201 }));
      vi.stubGlobal('fetch', fetchMock);

      await expect(submitCommunityPrice('r1', 's1', 1000)).resolves.toEqual({ id: 'contribution-1' });

      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);
      expect(Object.keys(body).sort()).toEqual(['amountKamas', 'deviceId', 'resourceId', 'serverId']);
      expect(body).toMatchObject({ resourceId: 'r1', serverId: 's1', amountKamas: 1000 });
      expect(typeof body.deviceId).toBe('string');
      expect(body.deviceId.length).toBeGreaterThan(0);
    });

    it('reuses the same deviceId across successive submissions from the same device', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'contribution-1' }), { status: 201 }));
      vi.stubGlobal('fetch', fetchMock);

      await submitCommunityPrice('r1', 's1', 1000);
      await submitCommunityPrice('r2', 's1', 2000);

      const bodies = fetchMock.mock.calls.map(([, options]) => JSON.parse((options as RequestInit).body as string));
      expect(bodies[1].deviceId).toBe(bodies[0].deviceId);
    });

    it('resolves undefined rather than throwing on failure', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

      await expect(submitCommunityPrice('r1', 's1', 1000)).resolves.toBeUndefined();
    });
  });

  describe('getLatestItemPrice (specs/016)', () => {
    it('resolves the latest item price with its date', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(
        { itemId: '208', serverId: 'mikhal', amountKamas: 6000, contributedAt: '2026-09-24T10:00:00.000Z' },
      ), { status: 200 }));
      vi.stubGlobal('fetch', fetchMock);

      await expect(getLatestItemPrice('208', 'mikhal')).resolves.toEqual({
        status: 'found',
        price: { itemId: '208', serverId: 'mikhal', amountKamas: 6000, contributedAt: '2026-09-24T10:00:00.000Z' },
      });
      expect(String(fetchMock.mock.calls[0][0])).toContain('/latest-price?itemId=208&serverId=mikhal');
    });

    it('resolves not-found on 404, unavailable on a network error or a malformed body', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('null', { status: 404 })));
      await expect(getLatestItemPrice('208', 'mikhal')).resolves.toEqual({ status: 'not-found' });
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
      await expect(getLatestItemPrice('208', 'mikhal')).resolves.toEqual({ status: 'unavailable' });
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ itemId: '208' }), { status: 200 })));
      await expect(getLatestItemPrice('208', 'mikhal')).resolves.toEqual({ status: 'unavailable' });
    });
  });

  describe('submitCommunityPrice kind (specs/016)', () => {
    beforeEach(() => window.localStorage.clear());

    it('sends kind "item" only when asked, leaving resource submissions unchanged', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'c1' }), { status: 201 }));
      vi.stubGlobal('fetch', fetchMock);
      await submitCommunityPrice('208', 'mikhal', 7000, 'item');
      await submitCommunityPrice('r1', 'mikhal', 100);
      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ resourceId: '208', amountKamas: 7000, kind: 'item' });
      expect(JSON.parse(fetchMock.mock.calls[1][1].body)).not.toHaveProperty('kind');
    });
  });
});
