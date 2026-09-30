import { beforeEach, describe, expect, it } from 'vitest';
import { clearReadCache } from '../../worker/src/read-cache';
import { BOT_KEY, createFmWorker, doAirLine } from '../support/fm-worker';

// specs/028-site-started-sessions: starting and stopping a session from the site, the bot's queue.
beforeEach(() => clearReadCache());

type Detail = {
  id: string; status: string; origin: string; canStop: boolean; totalKamas: number;
  owner: { discordUserId: string | null } | null;
  sync: { status: string; error: string | null } | null;
  fmItem: { id: string } | null;
};
type Command = { id: string; type: string; channelId: string; channelName: string; player?: { id: string; displayName: string } | null; item?: { name: string } | null };

async function setup() {
  const fm = createFmWorker();
  const cyril = await fm.login('42', { displayName: 'Cyril' });
  const bob = await fm.login('7', { displayName: 'Bob' });
  // Channels become known once the bot has used them.
  for (const channelId of ['c-anneau', 'c-cape']) {
    await fm.botEvent('session-start', { channelId, channelName: channelId.replace('c-', 'fm-') });
    await fm.botEvent('session-stop', { channelId, channelName: channelId.replace('c-', 'fm-') });
  }
  const start = (body: object, token = cyril) => fm.call('POST', '/fm/sessions', { token, body });
  const commands = async () => ((await (await fm.call('GET', '/fm/bot/commands', { authorization: `Bearer ${BOT_KEY}` })).json()) as { pollAfterSeconds: number; commands: Command[] });
  const ack = (id: string, body: object = { status: 'done' }) => fm.call('POST', `/fm/bot/commands/${id}/ack`, { authorization: `Bearer ${BOT_KEY}`, body });
  const detail = async (id: string, token = cyril) => (await fm.call('GET', `/fm/sessions/${id}`, { token })).json() as Promise<Detail>;
  return { fm, cyril, bob, start, commands, ack, detail };
}

describe('starting a session from the site (US1)', () => {
  it('lists the channels the bot has used, busy when a session is open there', async () => {
    const { fm, cyril, start } = await setup();
    await start({ channelId: 'c-anneau' });
    const { channels } = await (await fm.call('GET', '/fm/channels', { token: cyril })).json() as { channels: { channelId: string; channelName: string; busy: boolean }[] };
    expect(channels).toEqual([
      { channelId: 'c-anneau', channelName: 'fm-anneau', busy: true },
      { channelId: 'c-cape', channelName: 'fm-cape', busy: false },
    ]);
  });

  it('opens the session at once, owned by the player, attached to the item, and queues an open request', async () => {
    const { fm, cyril, start, commands } = await setup();
    const item = await (await fm.call('POST', '/fm/items', { token: cyril, body: { itemId: '8237', itemName: 'Anneau Rtograf', imageUrl: null, label: 'Rtograf PA' } })).json() as { id: string };
    const response = await start({ channelId: 'c-anneau', fmItemId: item.id });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      status: 'open', origin: 'site', owner: { discordUserId: '42' }, fmItem: { id: item.id }, sync: { status: 'pending', error: null }, canStop: true,
    });
    const { pollAfterSeconds, commands: queued } = await commands();
    expect(pollAfterSeconds).toBe(10);
    expect(queued).toEqual([{ id: expect.any(String), type: 'open', channelId: 'c-anneau', channelName: 'fm-anneau', player: { id: '42', displayName: 'Cyril' }, item: { name: 'Rtograf PA' } }]);
  });

  it('refuses an unknown channel, another player\'s item, or a busy channel', async () => {
    const { fm, bob, start } = await setup();
    expect((await start({ channelId: 'unknown' })).status).toBe(404);
    const bobItem = await (await fm.call('POST', '/fm/items', { token: bob, body: { itemId: '1', itemName: 'Coiffe', imageUrl: null } })).json() as { id: string };
    expect((await start({ channelId: 'c-anneau', fmItemId: bobItem.id })).status).toBe(404);
    await start({ channelId: 'c-anneau' });
    const busy = await start({ channelId: 'c-anneau' }, bob);
    expect(busy.status).toBe(409);
    expect(await busy.json()).toEqual({ error: 'channel-busy' });
  });

  it('lets a player have two open sessions in two channels', async () => {
    const { start } = await setup();
    expect((await start({ channelId: 'c-anneau' })).status).toBe(201);
    expect((await start({ channelId: 'c-cape' })).status).toBe(201);
  });
});

describe('the bot\'s queue (US1)', () => {
  it('needs the bot key', async () => {
    const { fm } = await setup();
    expect((await fm.call('GET', '/fm/bot/commands', { authorization: 'Bearer wrong' })).status).toBe(401);
  });

  it('hands out a request until it is acknowledged, then never again; a repeated ack changes nothing', async () => {
    const { start, commands, ack, detail } = await setup();
    const { id: sessionId } = await (await start({ channelId: 'c-anneau' })).json() as Detail;
    const [first] = (await commands()).commands;
    expect((await commands()).commands.map((command) => command.id)).toEqual([first.id]);

    expect((await ack(first.id)).status).toBe(200);
    expect((await commands()).commands).toEqual([]);
    expect((await detail(sessionId)).sync).toEqual({ status: 'opened', error: null });
    expect(await (await ack(first.id, { status: 'failed', error: 'late' })).json()).toMatchObject({ status: 'done' });
    expect((await detail(sessionId)).sync).toEqual({ status: 'opened', error: null });
  });

  it('hands out requests in the order they were made', async () => {
    const { start, commands } = await setup();
    await start({ channelId: 'c-anneau' });
    await start({ channelId: 'c-cape' });
    expect((await commands()).commands.map((command) => command.channelId)).toEqual(['c-anneau', 'c-cape']);
  });

  it('records a failure and its reason, cut to 200 characters', async () => {
    const { start, commands, ack, detail } = await setup();
    const { id: sessionId } = await (await start({ channelId: 'c-anneau' })).json() as Detail;
    const [command] = (await commands()).commands;
    await ack(command.id, { status: 'failed', error: 'x'.repeat(300) });
    expect((await detail(sessionId)).sync).toEqual({ status: 'failed', error: 'x'.repeat(200) });
  });

  it('answers 404 for an unknown request and 400 for an unknown status', async () => {
    const { start, commands, ack } = await setup();
    await start({ channelId: 'c-anneau' });
    const [command] = (await commands()).commands;
    expect((await ack('unknown')).status).toBe(404);
    expect((await ack(command.id, { status: 'maybe' })).status).toBe(400);
  });

  it('puts the bot\'s captures of that channel into the site\'s session', async () => {
    const { fm, start, detail } = await setup();
    const { id: sessionId } = await (await start({ channelId: 'c-anneau' })).json() as Detail;
    const answer = await (await fm.capture('42', 15868, [doAirLine], { channelId: 'c-anneau', channelName: 'fm-anneau' })).json() as { sessionId: string };
    expect(answer.sessionId).toBe(sessionId);
    expect((await detail(sessionId)).totalKamas).toBe(15868);
  });

  it('reads as not transmitted after 10 minutes, and can be sent again', async () => {
    const { fm, cyril, start, commands, detail } = await setup();
    const { id: sessionId } = await (await start({ channelId: 'c-anneau' })).json() as Detail;
    fm.sqlite.prepare("UPDATE fm_bot_commands SET created_at = '2020-01-01T00:00:00.000Z'").run();
    expect((await detail(sessionId)).sync).toEqual({ status: 'stale', error: null });

    const resent = await fm.call('POST', `/fm/sessions/${sessionId}/resend`, { token: cyril });
    expect(await resent.json()).toMatchObject({ sync: { status: 'pending' } });
    const queued = (await commands()).commands;
    expect(queued).toHaveLength(1);
    expect(fm.query("SELECT COUNT(*) AS n FROM fm_bot_commands WHERE status = 'cancelled'")).toEqual([{ n: 1 }]);
  });
});

describe('stopping a session from the site (US2)', () => {
  it('lets only the owner stop an open session, and queues a close once the bot opened it', async () => {
    const { fm, bob, cyril, start, commands, ack } = await setup();
    const { id: sessionId } = await (await start({ channelId: 'c-anneau' })).json() as Detail;
    await ack((await commands()).commands[0].id);

    expect((await fm.call('POST', `/fm/sessions/${sessionId}/stop`, { token: bob })).status).toBe(403);
    const stopped = await fm.call('POST', `/fm/sessions/${sessionId}/stop`, { token: cyril });
    expect(await stopped.json()).toMatchObject({ status: 'closed', canStop: false });
    expect((await commands()).commands).toEqual([{ id: expect.any(String), type: 'close', channelId: 'c-anneau', channelName: 'fm-anneau' }]);

    const again = await fm.call('POST', `/fm/sessions/${sessionId}/stop`, { token: cyril });
    expect(again.status).toBe(409);
    expect(await again.json()).toEqual({ error: 'not-open' });
  });

  it('cancels both requests when the bot had not opened the session yet', async () => {
    const { fm, cyril, start, commands, detail } = await setup();
    const { id: sessionId } = await (await start({ channelId: 'c-anneau' })).json() as Detail;
    await fm.call('POST', `/fm/sessions/${sessionId}/stop`, { token: cyril });
    expect((await commands()).commands).toEqual([]);
    expect((await detail(sessionId)).sync).toEqual({ status: 'cancelled', error: null });
  });

  it('ignores a capture posted before the bot ran the close, without reopening a session', async () => {
    const { fm, cyril, start, commands, ack } = await setup();
    const { id: sessionId } = await (await start({ channelId: 'c-anneau' })).json() as Detail;
    await ack((await commands()).commands[0].id);
    await fm.call('POST', `/fm/sessions/${sessionId}/stop`, { token: cyril });

    const answer = await (await fm.capture('42', 1000, [doAirLine], { channelId: 'c-anneau', channelName: 'fm-anneau' })).json();
    expect(answer).toMatchObject({ status: 'ignored', reason: 'session-closed' });
    expect(fm.query("SELECT COUNT(*) AS n FROM fm_sessions WHERE channel_id = 'c-anneau' AND status = 'open'")).toEqual([{ n: 0 }]);
    expect(fm.query('SELECT COUNT(*) AS n FROM fm_captures')).toEqual([{ n: 0 }]);
  });

  it('cancels a queued close when the player types /fmstop', async () => {
    const { fm, cyril, start, commands, ack } = await setup();
    const { id: sessionId } = await (await start({ channelId: 'c-anneau' })).json() as Detail;
    await ack((await commands()).commands[0].id);
    await fm.call('POST', `/fm/sessions/${sessionId}/stop`, { token: cyril });
    await fm.botEvent('session-stop', { channelId: 'c-anneau', channelName: 'fm-anneau' });
    expect((await commands()).commands).toEqual([]);
  });
});

describe('/fmstart owner (US4)', () => {
  it('makes whoever typed /fmstart the owner, who can stop it from the site', async () => {
    const { fm, cyril } = await setup();
    const { sessionId } = await (await fm.botEvent('session-start', {
      channelId: 'c-coiffe', channelName: 'fm-coiffe', author: { id: '42', displayName: 'Cyril', avatarUrl: null },
    })).json() as { sessionId: string };
    const detail = await (await fm.call('GET', `/fm/sessions/${sessionId}`, { token: cyril })).json() as Detail;
    expect(detail).toMatchObject({ origin: 'discord', owner: { discordUserId: '42' }, sync: null, canStop: true });
    expect((await fm.call('POST', `/fm/sessions/${sessionId}/stop`, { token: cyril })).status).toBe(200);
  });

  it('keeps sessions without owner for a bot not updated yet', async () => {
    const { fm, cyril } = await setup();
    const { sessionId } = await (await fm.botEvent('session-start', { channelId: 'c-coiffe', channelName: 'fm-coiffe' })).json() as { sessionId: string };
    expect(await (await fm.call('GET', `/fm/sessions/${sessionId}`, { token: cyril })).json()).toMatchObject({ owner: null, canStop: false });
  });

  it('refuses an invalid author', async () => {
    const { fm } = await setup();
    expect((await fm.botEvent('session-start', { author: { id: '' } })).status).toBe(400);
  });
});

describe('captures imported on the site (US3)', () => {
  const line = { itemName: 'Rune Do Air', itemId: '11663', quantity: 10, totalKamas: 15868 };

  it('go into an open session of the player, or refuse a closed one or another player\'s', async () => {
    const { fm, cyril, bob, start, detail } = await setup();
    const { id: sessionId } = await (await start({ channelId: 'c-anneau' })).json() as Detail;
    const imported = await fm.call('POST', '/fm/imports', { token: cyril, body: { sharePrices: false, lines: [line], sessionId } });
    expect(imported.status).toBe(201);
    expect((await detail(sessionId)).totalKamas).toBe(15868);

    expect((await fm.call('POST', '/fm/imports', { token: bob, body: { sharePrices: false, lines: [line], sessionId } })).status).toBe(403);
    await fm.call('POST', `/fm/sessions/${sessionId}/stop`, { token: cyril });
    const closed = await fm.call('POST', '/fm/imports', { token: cyril, body: { sharePrices: false, lines: [line], sessionId } });
    expect(closed.status).toBe(409);
    expect(await closed.json()).toEqual({ error: 'session-not-open' });
  });

  it('lists only the player\'s open sessions for the import', async () => {
    const { fm, cyril, bob, start } = await setup();
    await start({ channelId: 'c-anneau' });
    await start({ channelId: 'c-cape' }, bob);
    const { sessions } = await (await fm.call('GET', '/fm/sessions?mine=open', { token: cyril })).json() as { sessions: { channelName: string }[] };
    expect(sessions.map((session) => session.channelName)).toEqual(['fm-anneau']);
  });
});
