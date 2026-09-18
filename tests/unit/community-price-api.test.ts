import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCommunityPrice, submitCommunityPrice } from '../../src/services/community-price-api';

describe('community price API service (Cloudflare Worker client)', () => {
  beforeEach(() => vi.restoreAllMocks());

  describe('getCommunityPrice', () => {
    it('resolves a found median from a successful response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(
        { resourceId: 'r1', serverId: 's1', medianAmountKamas: 1200, sampleSize: 4 },
      ), { status: 200 })));

      await expect(getCommunityPrice('r1', 's1')).resolves.toEqual({
        status: 'found',
        price: { resourceId: 'r1', serverId: 's1', medianAmountKamas: 1200, sampleSize: 4 },
      });
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
});
