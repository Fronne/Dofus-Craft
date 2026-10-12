import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCommunityPrice, getCommunityPrices, getLatestItemPrice, refreshExternalPrices, refreshRecipePrices, submitCommunityPrice } from '../../src/services/community-price-api';

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

    it('reads the origin of the latest price, and ignores an unknown one (specs/025)', async () => {
      const base = {
        resourceId: 'r1', serverId: 's1', medianAmountKamas: 1200, sampleSize: 4,
        latestAmountKamas: 1100, latestContributionAt: '2026-09-28T13:51:28.940Z',
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...base, latestOrigin: 'bot' }), { status: 200 })));
      await expect(getCommunityPrice('r1', 's1')).resolves.toEqual({ status: 'found', price: { ...base, latestOrigin: 'bot' } });

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...base, latestOrigin: 'robot' }), { status: 200 })));
      const lookup = await getCommunityPrice('r1', 's1');
      expect(lookup.status).toBe('found');
      expect(lookup.status === 'found' && lookup.price.latestOrigin).toBeUndefined();
    });

    it('resolves unavailable when the answer has no latest price (specs/024)', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(
        { resourceId: 'r1', serverId: 's1', medianAmountKamas: 1200, sampleSize: 4 },
      ), { status: 200 })));

      await expect(getCommunityPrice('r1', 's1')).resolves.toEqual({ status: 'unavailable' });
    });

    // The real Worker answer (worker/src/contribution.ts `communityPricesResponse`): the server is
    // given once at the top, never on each price. Missing it made every batched read unavailable.
    it('accepts a batched answer whose prices carry no serverId, as the Worker sends it', async () => {
      const { communityPricesResponse } = await import('../../worker/src/contribution');
      const { createTestD1 } = await import('../support/sqlite-d1');
      const { d1, insert } = createTestD1();
      insert({ resourceId: '11929', amountKamas: 1437, createdAt: new Date(Date.now() - 6 * 86_400_000).toISOString(), deviceId: 'a' });
      insert({ resourceId: '11929', amountKamas: 1848, createdAt: new Date(Date.now() - 3_600_000).toISOString(), deviceId: 'a' });
      const { body } = await communityPricesResponse(d1, new URL('https://api.test/community-prices?serverId=mikhal&resourceIds=11929'));
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 })));

      const lookup = await getCommunityPrices(['11929'], 'mikhal');
      expect(lookup.status).toBe('found');
      expect(lookup.status === 'found' && lookup.prices[0]).toMatchObject({ resourceId: '11929', serverId: 'mikhal', latestAmountKamas: 1848 });
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

  // specs/046-hdv-huzounet-load (contracts/external-prices-refresh.md).
  describe('prices read on Huzounet (specs/046)', () => {
    const base = { resourceId: '371', medianAmountKamas: 0, sampleSize: 0, latestAmountKamas: 42, latestContributionAt: '2026-10-12T02:10:00.000Z' };
    const answer = (row: Record<string, unknown>) => vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ serverId: 'mikhal', prices: [row] }), { status: 200 })));
    const read = async () => {
      const lookup = await getCommunityPrices(['371'], 'mikhal');
      return lookup.status === 'found' ? lookup.prices[0] : undefined;
    };

    it('keeps a price only Huzounet knows, with its origin and no median', async () => {
      answer({ ...base, latestOrigin: 'external' });
      await expect(read()).resolves.toEqual({ ...base, serverId: 'mikhal', latestOrigin: 'external' });
    });

    it('keeps what Huzounet says of its price, and nothing else', async () => {
      answer({ ...base, latestOrigin: 'external', latestFragile: 'provisional' });
      expect((await read())?.latestFragile).toBe('provisional');
      answer({ ...base, latestOrigin: 'external', latestFragile: 'stale' });
      expect((await read())?.latestFragile).toBe('stale');
      answer({ ...base, latestOrigin: 'external', latestFragile: 'doubtful' });
      expect(await read()).toMatchObject({ latestOrigin: 'external', latestFragile: undefined });
      answer({ ...base, latestOrigin: 'bot', latestFragile: 'stale' });
      expect(await read()).toMatchObject({ latestOrigin: 'bot', latestFragile: undefined });
    });
  });

  describe('refreshRecipePrices (specs/047)', () => {
    it('asks the API to read again the item of a recipe and its resources, and tells how many prices were read', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ refreshed: 2 }), { status: 200 }));
      vi.stubGlobal('fetch', fetchMock);
      await expect(refreshRecipePrices('mikhal', '14076', ['14076', '303'])).resolves.toEqual({ status: 'ok', refreshed: 2 });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toMatch(/\/external-prices\/refresh$/);
      expect(init.method).toBe('POST');
      expect(init.headers).toMatchObject({ 'Content-Type': 'application/json', Authorization: expect.stringMatching(/^Bearer /) });
      // Neither `tab` nor `last`: those belong to an HDV tab's load, with its hourly limit (specs/046).
      expect(JSON.parse(init.body)).toEqual({ serverId: 'mikhal', itemId: '14076', ids: ['14076', '303'] });
    });

    it('tells when nothing had to be read again', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ refreshed: 0 }), { status: 200 })));
      await expect(refreshRecipePrices('mikhal', '14076', ['14076'])).resolves.toEqual({ status: 'ok', refreshed: 0 });
    });

    it.each([
      [429, { error: 'too-soon' }, 'too-soon'],
      [404, { error: 'unknown-server' }, 'not-read'],
      [502, { error: 'unavailable' }, 'unavailable'],
      [503, { error: 'disabled' }, 'unavailable'],
      [400, { error: 'invalid' }, 'unavailable'],
      [200, { ok: true }, 'unavailable'],
    ])('reads a %i answer as %s', async (status, body, expected) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
      await expect(refreshRecipePrices('mikhal', '14076', ['14076'])).resolves.toEqual({ status: expected });
    });

    it('never throws: an unreadable answer or a network failure is an unavailable service', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>', { status: 200 })));
      await expect(refreshRecipePrices('mikhal', '14076', ['14076'])).resolves.toEqual({ status: 'unavailable' });
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
      await expect(refreshRecipePrices('mikhal', '14076', ['14076'])).resolves.toEqual({ status: 'unavailable' });
    });
  });

  describe('refreshExternalPrices (specs/046)', () => {
    const TAB = { tab: 'animals', last: false };

    it('asks the API to read the items of a server again, and tells how many prices were read', async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ refreshed: 2 }), { status: 200 }));
      vi.stubGlobal('fetch', fetchMock);
      await expect(refreshExternalPrices('mikhal', ['371', '372'], { tab: 'consumables', last: true })).resolves.toEqual({ status: 'ok', refreshed: 2 });
      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toMatch(/\/external-prices\/refresh$/);
      expect(init.method).toBe('POST');
      expect(init.headers).toMatchObject({ 'Content-Type': 'application/json', Authorization: expect.stringMatching(/^Bearer /) });
      expect(JSON.parse(init.body)).toEqual({ serverId: 'mikhal', ids: ['371', '372'], tab: 'consumables', last: true });
    });

    it.each([
      [429, { error: 'too-soon' }, 'too-soon'],
      [404, { error: 'unknown-server' }, 'unknown-server'],
      [503, { error: 'disabled' }, 'disabled'],
      [502, { error: 'unavailable' }, 'unavailable'],
      [400, { error: 'invalid' }, 'unavailable'],
      [401, { error: 'Unauthorized' }, 'unavailable'],
      [200, { done: true }, 'unavailable'],
    ])('reads a %i answer %j as %s', async (status, body, expected) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
      await expect(refreshExternalPrices('mikhal', ['371'], TAB)).resolves.toMatchObject({ status: expected });
    });

    it('tells whether Huzounet was read at all, when the API says so', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ refreshed: 0, requests: 0 }), { status: 200 })));
      await expect(refreshExternalPrices('mikhal', ['371'], TAB)).resolves.toEqual({ status: 'ok', refreshed: 0, requests: 0 });
    });

    it('tells the hourly limit of a tab apart from a read that came too soon', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'hourly-limit', retryAt: '2026-10-12T15:05:00.000Z' }), { status: 429 })));
      await expect(refreshExternalPrices('mikhal', ['371'], TAB)).resolves.toEqual({ status: 'hourly-limit', retryAt: '2026-10-12T15:05:00.000Z' });
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Too many requests', { status: 429 })));
      await expect(refreshExternalPrices('mikhal', ['371'], TAB)).resolves.toEqual({ status: 'too-soon' });
    });

    it('never throws: an unreadable body is unavailable, a network error is unreachable', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>', { status: 200 })));
      await expect(refreshExternalPrices('mikhal', ['371'], TAB)).resolves.toEqual({ status: 'unavailable' });
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
      await expect(refreshExternalPrices('mikhal', ['371'], TAB)).resolves.toEqual({ status: 'unreachable' });
    });

    it('makes the next reads fresh ones once prices were read, not when nothing changed', async () => {
      vi.resetModules();
      const api = await import('../../src/services/community-price-api');
      const fetchMock = vi.fn(async (url: string) => new Response(JSON.stringify(String(url).includes('/refresh') ? { refreshed: calls.shift() } : { serverId: 'mikhal', prices: [] }), { status: 200 }));
      const calls = [0, 3];
      vi.stubGlobal('fetch', fetchMock);
      await api.refreshExternalPrices('mikhal', ['371'], TAB);
      await api.getCommunityPrices(['371'], 'mikhal');
      expect(String(fetchMock.mock.calls[1][0])).not.toContain('fresh=1');
      await api.refreshExternalPrices('mikhal', ['371'], TAB);
      await api.getCommunityPrices(['371'], 'mikhal');
      expect(String(fetchMock.mock.calls[3][0])).toContain('fresh=1');
    });
  });
});
