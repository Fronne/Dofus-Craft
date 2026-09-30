import { beforeEach, describe, expect, it } from 'vitest';
import { clearReadCache } from '../../worker/src/read-cache';
import { createFmWorker } from '../support/fm-worker';

// specs/025-rune-purchase-import (US5, contracts/fm-site-api.md): the lines a player validated after
// reading a capture on the site.
beforeEach(() => clearReadCache());

const doAir = { itemName: 'Rune Do Air', itemId: '11663', quantity: 10, totalKamas: 15868 };
const recent = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();

describe('POST /fm/imports', () => {
  it('needs a session token', async () => {
    const fm = createFmWorker();
    expect((await fm.call('POST', '/fm/imports', { body: { sharePrices: true, lines: [doAir] } })).status).toBe(401);
  });

  it('refuses a line without a known resource', async () => {
    const fm = createFmWorker();
    const token = await fm.login('42');
    for (const line of [{ ...doAir, itemId: undefined }, { ...doAir, itemId: '999999999' }, { ...doAir, quantity: 0 }]) {
      expect((await fm.call('POST', '/fm/imports', { token, body: { sharePrices: true, lines: [line] } })).status).toBe(400);
    }
  });

  it('refuses an import while the profile has no server', async () => {
    const fm = createFmWorker();
    const token = await fm.login('42', { serverId: null });
    const response = await fm.call('POST', '/fm/imports', { token, body: { sharePrices: true, lines: [doAir] } });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'no-server' });
  });

  it('records the spending outside any session and shares capture prices, with no outlier filter', async () => {
    const fm = createFmWorker();
    const token = await fm.login('42');
    fm.insert({ resourceId: '11663', amountKamas: 100, createdAt: recent(1), deviceId: 'a' });

    const response = await fm.call('POST', '/fm/imports', { token, body: { sharePrices: true, lines: [doAir, doAir] } });
    expect(response.status).toBe(201);
    expect((await response.json() as { lines: unknown[] }).lines).toEqual([
      { index: 0, unitPriceKamas: 1587, priceStatus: 'recorded' },
      { index: 1, unitPriceKamas: 1587, priceStatus: 'recorded' },
    ]);
    expect(fm.query('SELECT session_id, origin, spent_kamas FROM fm_captures')).toEqual([{ session_id: null, origin: 'capture', spent_kamas: 31736 }]);
    expect(fm.query("SELECT COUNT(*) AS n FROM community_price_contributions WHERE origin = 'capture'")).toEqual([{ n: 2 }]);
  });

  it('shares no price in personal mode', async () => {
    const fm = createFmWorker();
    const token = await fm.login('42');
    const response = await fm.call('POST', '/fm/imports', { token, body: { sharePrices: false, lines: [doAir] } });
    expect((await response.json() as { lines: { priceStatus: string }[] }).lines[0].priceStatus).toBe('personal-mode');
    expect(fm.query('SELECT COUNT(*) AS n FROM community_price_contributions')).toEqual([{ n: 0 }]);
    expect(fm.query('SELECT spent_kamas FROM fm_captures')).toEqual([{ spent_kamas: 15868 }]);
  });
});
