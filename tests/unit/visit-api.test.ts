import { beforeEach, describe, expect, it, vi } from 'vitest';
import { recordVisit } from '../../src/services/visit-api';

describe('visit API service (specs/006-anonymous-visit-count)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('sends a POST /visit body containing exactly a non-empty deviceId', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await recordVisit();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/visit');
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body as string);
    expect(Object.keys(body)).toEqual(['deviceId']);
    expect(typeof body.deviceId).toBe('string');
    expect(body.deviceId.length).toBeGreaterThan(0);
  });

  it('resolves without throwing on a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(recordVisit()).resolves.toBeUndefined();
  });

  it('resolves without throwing on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));

    await expect(recordVisit()).resolves.toBeUndefined();
  });
});
