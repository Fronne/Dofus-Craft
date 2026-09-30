import { beforeEach, describe, expect, it } from 'vitest';
import { clearReadCache } from '../../worker/src/read-cache';
import { BOT_KEY, createFmWorker, doAirLine } from '../support/fm-worker';

// specs/025-rune-purchase-import (US2, contracts/fm-bot-api.md): the bot's events.
beforeEach(() => clearReadCache());

type Session = { id: string; status: string; opened_at: string; closed_at: string | null };

describe('POST /fm/bot/events', () => {
  it('refuses an event without the bot key, with a wrong key or with the site key, and records nothing', async () => {
    const fm = createFmWorker();
    const body = { type: 'session-start', eventId: 'e1', channelId: 'c', channelName: 'fm', occurredAt: '2026-09-30T18:00:00Z' };
    for (const authorization of ['', 'Bearer wrong', 'Bearer app-key']) {
      expect((await fm.call('POST', '/fm/bot/events', { authorization, body })).status).toBe(401);
    }
    expect(fm.query('SELECT * FROM fm_sessions')).toEqual([]);
  });

  it('refuses an event missing a common field', async () => {
    const fm = createFmWorker();
    const response = await fm.call('POST', '/fm/bot/events', {
      authorization: `Bearer ${BOT_KEY}`,
      body: { type: 'session-start', channelId: 'c', channelName: 'fm', occurredAt: '2026-09-30T18:00:00Z' },
    });
    expect(response.status).toBe(400);
  });

  it('opens a session, and closes it when the channel starts a new one', async () => {
    const fm = createFmWorker();
    const first = await (await fm.botEvent('session-start')).json() as { sessionId: string };
    const second = await (await fm.botEvent('session-start')).json() as { sessionId: string };

    const sessions = fm.query<Session>('SELECT id, status, opened_at, closed_at FROM fm_sessions ORDER BY opened_at');
    expect(sessions.map((session) => [session.id, session.status])).toEqual([[first.sessionId, 'closed'], [second.sessionId, 'open']]);
    expect(sessions[0].closed_at).not.toBeNull();
  });

  it('records the spending the bot counted and every valid line of a capture', async () => {
    const fm = createFmWorker();
    await fm.botEvent('session-start');
    const response = await fm.capture('42', 63472, [doAirLine, doAirLine, doAirLine, doAirLine]);
    const answer = await response.json() as { status: string; lines: { index: number; unitPriceKamas: number }[] };

    expect(answer.status).toBe('ok');
    expect(answer.lines.map((line) => [line.index, line.unitPriceKamas])).toEqual([[0, 1587], [1, 1587], [2, 1587], [3, 1587]]);
    expect(fm.query('SELECT spent_kamas, origin FROM fm_captures')).toEqual([{ spent_kamas: 63472, origin: 'bot' }]);
    expect(fm.query('SELECT COUNT(*) AS n FROM fm_purchase_lines')).toEqual([{ n: 4 }]);
  });

  it('ignores an invalid line without refusing the others', async () => {
    const fm = createFmWorker();
    await fm.login('42');
    const answer = await (await fm.capture('42', 15868, [doAirLine, { name: 'Rune Fo', qty: 0, price: 100 }])).json() as { lines: { priceStatus: string }[] };
    expect(answer.lines.map((line) => line.priceStatus)).toEqual(['recorded', 'invalid']);
    expect(fm.query('SELECT COUNT(*) AS n FROM fm_purchase_lines')).toEqual([{ n: 1 }]);
  });

  it('refuses a capture with more than 200 lines', async () => {
    const fm = createFmWorker();
    expect((await fm.capture('42', 1, Array(201).fill(doAirLine))).status).toBe(400);
  });

  it('opens a session at the capture date when none is open in the channel', async () => {
    const fm = createFmWorker();
    await fm.capture('42', 15868, [doAirLine]);
    const [session] = fm.query<Session>('SELECT status, opened_at FROM fm_sessions');
    const [capture] = fm.query<{ created_at: string }>('SELECT created_at FROM fm_captures');
    expect(session).toMatchObject({ status: 'open', opened_at: capture.created_at });
  });

  // specs/030-private-fm-sessions (FR-003): a session without owner would be seen by no one.
  it('gives a session opened by a capture to the personal channel\'s owner, or else to the capture\'s author', async () => {
    const fm = createFmWorker();
    await fm.capture('42', 15868, [doAirLine]);
    await fm.botEvent('channel-created', { channelId: 'c-perso', channelName: 'fm-perso', author: { id: '7', displayName: 'Bob', avatarUrl: null } });
    await fm.capture('42', 1000, [doAirLine], { channelId: 'c-perso', channelName: 'fm-perso' });
    expect(fm.query('SELECT channel_id, owner_discord_user_id FROM fm_sessions ORDER BY channel_id')).toEqual([
      { channel_id: 'c-perso', owner_discord_user_id: '7' },
      { channel_id: 'channel-1', owner_discord_user_id: '42' },
    ]);
  });

  it('changes nothing when the same event is sent again', async () => {
    const fm = createFmWorker();
    await fm.login('42');
    const event = { author: { id: '42', displayName: 'Cyril', avatarUrl: null }, spentKamas: 15868, lines: [doAirLine], eventId: 'message-1' };
    const first = await (await fm.botEvent('capture', event)).json();
    const again = await (await fm.botEvent('capture', event)).json();

    expect(again).toEqual({ ...(first as object), duplicate: true });
    expect(fm.query('SELECT COUNT(*) AS n FROM fm_captures')).toEqual([{ n: 1 }]);
    expect(fm.query('SELECT COUNT(*) AS n FROM community_price_contributions')).toEqual([{ n: 1 }]);
  });

  it('empties the open session on a reset, and closes it on a stop', async () => {
    const fm = createFmWorker();
    await fm.botEvent('session-start');
    await fm.capture('42', 15868, [doAirLine]);
    await fm.botEvent('session-reset');
    expect(fm.query('SELECT COUNT(*) AS n FROM fm_captures')).toEqual([{ n: 0 }]);
    expect(fm.query('SELECT status FROM fm_sessions')).toEqual([{ status: 'open' }]);

    await fm.botEvent('session-stop');
    expect(fm.query('SELECT status FROM fm_sessions')).toEqual([{ status: 'closed' }]);
  });

  it('ignores a reset or a stop without an open session', async () => {
    const fm = createFmWorker();
    expect(await (await fm.botEvent('session-reset')).json()).toMatchObject({ status: 'ignored' });
    expect(await (await fm.botEvent('session-stop')).json()).toMatchObject({ status: 'ignored' });
  });

  it('creates a public player without a server, then keeps their name and avatar up to date', async () => {
    const fm = createFmWorker();
    await fm.capture('42', 1, [], { author: { id: '42', displayName: 'Ancien', avatarUrl: null } });
    await fm.capture('42', 1, [], { author: { id: '42', displayName: 'Nouveau', avatarUrl: 'https://cdn.test/a.png' } });
    expect(fm.query('SELECT display_name, avatar_url, server_id, is_private FROM fm_players')).toEqual([
      { display_name: 'Nouveau', avatar_url: 'https://cdn.test/a.png', server_id: null, is_private: 0 },
    ]);
  });

  it('files a capture under the server the profile had when it was recorded', async () => {
    const fm = createFmWorker();
    await fm.login('42', { serverId: 'mikhal' });
    await fm.capture('42', 15868, [doAirLine]);
    await fm.call('PATCH', '/fm/me', { token: 'token-42', body: { serverId: 'dakal' } });
    await fm.capture('42', 15868, [doAirLine]);
    expect(fm.query('SELECT server_id FROM fm_captures ORDER BY created_at')).toEqual([{ server_id: 'mikhal' }, { server_id: 'dakal' }]);
  });
});
