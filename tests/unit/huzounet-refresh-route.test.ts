import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker, { type Env } from '../../worker/src/index';
import { clearReadCache } from '../../worker/src/read-cache';
import { createTestD1 } from '../support/sqlite-d1';

// specs/045-restore-production-worker (US2, contracts/api.md): POST /external-prices/refresh, with
// Huzounet simulated.
beforeEach(() => clearReadCache());
afterEach(() => vi.unstubAllGlobals());

function setup(vars: Partial<Env> = {}) {
  const test = createTestD1();
  const env = { DB: test.d1 as unknown as Env['DB'], COMMUNITY_API_KEY: 'app-key', HUZOUNET_SYNC: '1', ...vars } as Env;
  const refresh = (body: unknown, authorization = 'Bearer app-key') => worker.fetch(new Request('https://api.test/external-prices/refresh', {
    method: 'POST',
    headers: { Authorization: authorization, 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }), env);
  const huzounet = vi.fn(async () => Response.json({ prices: { 1: { price: { numerator: 300, denominator: 2 }, receivedAt: '2026-10-05T20:00:00.000Z' } } }));
  vi.stubGlobal('fetch', huzounet);
  return { ...test, env, refresh, huzounet };
}

describe('POST /external-prices/refresh', () => {
  it('needs the site key', async () => {
    const { refresh, huzounet } = setup();
    expect((await refresh({ serverId: 'mikhal', ids: ['1'] }, 'Bearer wrong')).status).toBe(401);
    expect(huzounet).not.toHaveBeenCalled();
  });

  it('reads the prices asked for and says how many it refreshed', async () => {
    const { refresh, sqlite } = setup();
    const response = await refresh({ serverId: 'mikhal', ids: ['1', '2'], itemId: '1' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ refreshed: 1 });
    expect(sqlite.prepare('SELECT resource_id, unit_price_kamas, is_item FROM external_prices').all()).toEqual([{ resource_id: '1', unit_price_kamas: 150, is_item: 1 }]);

    // Read less than two minutes ago: nothing is asked again.
    expect(await (await refresh({ serverId: 'mikhal', ids: ['1'] })).json()).toEqual({ refreshed: 0 });
  });

  it('answers 503 when the reading is turned off', async () => {
    const { refresh, huzounet } = setup({ HUZOUNET_SYNC: '0' });
    const response = await refresh({ serverId: 'mikhal', ids: ['1'] });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'disabled' });
    expect(huzounet).not.toHaveBeenCalled();
  });

  it('answers 400 for an invalid body, 404 for a server it does not read', async () => {
    const { refresh } = setup();
    expect((await refresh('not json')).status).toBe(400);
    const invalid = await refresh({ serverId: 'mikhal', ids: [] });
    expect([invalid.status, await invalid.json()]).toEqual([400, { error: 'invalid' }]);
    const unknown = await refresh({ serverId: 'dakal', ids: ['1'] });
    expect([unknown.status, await unknown.json()]).toEqual([404, { error: 'unknown-server' }]);
  });

  it('answers 429 too soon after another read, or past the rate limit, and 502 when Huzounet fails', async () => {
    const { refresh, huzounet } = setup();
    await refresh({ serverId: 'mikhal', ids: ['1'] });
    const tooSoon = await refresh({ serverId: 'mikhal', ids: ['2'] });
    expect([tooSoon.status, await tooSoon.json()]).toEqual([429, { error: 'too-soon' }]);

    const limited = setup({ CONTRIBUTION_LIMITER: { limit: async () => ({ success: false }) } as unknown as Env['CONTRIBUTION_LIMITER'] });
    expect((await limited.refresh({ serverId: 'mikhal', ids: ['1'] })).status).toBe(429);

    const failing = setup();
    failing.huzounet.mockResolvedValueOnce(new Response('down', { status: 500 }));
    const unavailable = await failing.refresh({ serverId: 'mikhal', ids: ['1'] });
    expect([unavailable.status, await unavailable.json()]).toEqual([502, { error: 'unavailable' }]);
    // The read refused as too soon never reached Huzounet.
    expect(huzounet).toHaveBeenCalledTimes(1);
  });
});
