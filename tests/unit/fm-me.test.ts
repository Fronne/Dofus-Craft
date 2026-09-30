import { beforeEach, describe, expect, it } from 'vitest';
import { clearReadCache } from '../../worker/src/read-cache';
import { createFmWorker, doAirLine } from '../support/fm-worker';

// specs/025-rune-purchase-import (US1, US3, contracts/fm-site-api.md): the logged-in player's profile,
// their spending and the deletion of everything about them.
beforeEach(() => clearReadCache());

type Profile = {
  totalKamas: number;
  sessions: { channelName: string; spentKamas: number }[];
  importedKamas: number;
  items: { itemName: string; quantity: number }[];
};

describe('/fm/me', () => {
  it('needs a session token', async () => {
    const fm = createFmWorker();
    expect((await fm.call('GET', '/fm/me')).status).toBe(401);
  });

  it('gives the profile, and updates its server and visibility', async () => {
    const fm = createFmWorker();
    const token = await fm.login('42', { displayName: 'Cyril', serverId: null });
    expect(await (await fm.call('GET', '/fm/me', { token })).json()).toMatchObject({
      discordUserId: '42', displayName: 'Cyril', serverId: null, isPrivate: false,
    });

    const updated = await fm.call('PATCH', '/fm/me', { token, body: { serverId: 'mikhal', isPrivate: true } });
    expect(await updated.json()).toMatchObject({ serverId: 'mikhal', isPrivate: true });
  });

  it('refuses an invalid server or visibility', async () => {
    const fm = createFmWorker();
    const token = await fm.login('42');
    for (const body of [{ serverId: '' }, { serverId: 12 }, { isPrivate: 'oui' }, {}]) {
      expect((await fm.call('PATCH', '/fm/me', { token, body })).status).toBe(400);
    }
  });
});

describe('GET /fm/players/{id}', () => {
  it('gives the total, the spending per session and outside sessions, and the per-item detail', async () => {
    const fm = createFmWorker();
    const token = await fm.login('42');
    await fm.botEvent('session-start');
    await fm.capture('42', 100000, [doAirLine]);
    await fm.botEvent('session-start', { channelName: 'fm-cape' });
    await fm.capture('42', 50000, [doAirLine]);
    await fm.call('POST', '/fm/imports', { token, body: { sharePrices: false, lines: [{ itemName: 'Rune Fo', itemId: '1519', quantity: 10, totalKamas: 3000 }] } });

    const profile = await (await fm.call('GET', '/fm/players/42', { token })).json() as Profile;
    expect(profile.totalKamas).toBe(153000);
    expect(profile.sessions.map((session) => [session.channelName, session.spentKamas])).toEqual([['fm-cape', 50000], ['fm-coiffe', 100000]]);
    expect(profile.importedKamas).toBe(3000);
    expect(profile.items.map((item) => [item.itemName, item.quantity])).toEqual([['Rune Do Air', 20], ['Rune Fo', 10]]);
  });

  it('keeps the purchases a player made in Discord before logging in for the first time (FR-013)', async () => {
    const fm = createFmWorker();
    await fm.capture('42', 15868, [doAirLine]);
    const token = await fm.login('42');

    expect(fm.query('SELECT COUNT(*) AS n FROM fm_players')).toEqual([{ n: 1 }]);
    const profile = await (await fm.call('GET', '/fm/players/42', { token })).json() as Profile;
    expect(profile.totalKamas).toBe(15868);
  });
});

describe('DELETE /fm/me', () => {
  it('removes the player, their logins and purchases; sessions no longer count them; prices stay', async () => {
    const fm = createFmWorker();
    const token = await fm.login('42');
    const other = await fm.login('7');
    await fm.botEvent('session-start');
    await fm.capture('42', 15868, [doAirLine]);
    await fm.capture('7', 1000, [{ name: 'Rune Fo', qty: 1, price: 1000 }]);

    expect((await fm.call('DELETE', '/fm/me', { token })).status).toBe(204);
    expect(fm.query("SELECT COUNT(*) AS n FROM fm_players WHERE discord_user_id = '42'")).toEqual([{ n: 0 }]);
    expect(fm.query("SELECT COUNT(*) AS n FROM fm_auth_sessions WHERE discord_user_id = '42'")).toEqual([{ n: 0 }]);
    expect(fm.query("SELECT COUNT(*) AS n FROM fm_captures WHERE discord_user_id = '42'")).toEqual([{ n: 0 }]);
    expect(fm.query('SELECT COUNT(*) AS n FROM fm_purchase_lines')).toEqual([{ n: 1 }]);
    expect(fm.query('SELECT COUNT(*) AS n FROM community_price_contributions')).toEqual([{ n: 2 }]);

    const { sessions } = await (await fm.call('GET', '/fm/sessions', { token: other })).json() as { sessions: { totalKamas: number; players: unknown[] }[] };
    expect(sessions[0].totalKamas).toBe(1000);
    expect(sessions[0].players).toHaveLength(1);
    expect((await fm.call('GET', '/fm/me', { token })).status).toBe(401);
  });
});
