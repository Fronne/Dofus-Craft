import { beforeEach, describe, expect, it } from 'vitest';
import { clearReadCache } from '../../worker/src/read-cache';
import { BOT_KEY, createFmWorker, doAirLine } from '../support/fm-worker';

// specs/045-restore-production-worker (US3, contracts/api.md « Séances de FM »): a séance de FM is a
// channel and the sessions its owner held in it.
beforeEach(() => clearReadCache());

const cyrilAuthor = { id: '42', displayName: 'Cyril', avatarUrl: null };
const coiffe = { itemId: '2411', itemName: 'Coiffe Bouftou', imageUrl: 'https://api.dofusdb.fr/img/items/16010.png' };

type Summary = { id: string; name: string; state: string; discord: string; fmItem: { id: string; name: string; imageUrl: string | null } | null; totalKamas: number; sessionCount: number; captureCount: number };
type Detail = Summary & {
  quantity: number;
  items: { itemName: string; quantity: number; totalKamas: number; corrected: boolean }[];
  sessions: { id: string; status: string; totalKamas: number; canStop: boolean; captures: { id: string; spentKamas: number; lines: { id: string; itemName: string }[]; ignored: { itemName: string }[] }[] }[];
  request: { type: string; status: string; error: string | null } | null;
  canResume: boolean; canArchive: boolean; canReopen: boolean;
};

async function setup() {
  const fm = createFmWorker();
  const cyril = await fm.login('42', { displayName: 'Cyril' });
  const bob = await fm.login('7', { displayName: 'Bob' });
  const created = (channelId: string, author = cyrilAuthor) => fm.botEvent('channel-created', { channelId, channelName: `fm-${channelId}`, author });
  // A session of Cyril in a channel with one capture; left open unless `close`.
  const session = async (channelId: string, spent = 15868, close = true) => {
    await fm.botEvent('session-start', { channelId, channelName: `fm-${channelId}`, author: cyrilAuthor });
    await fm.capture('42', spent, [doAirLine], { channelId, channelName: `fm-${channelId}` });
    if (close) await fm.botEvent('session-stop', { channelId, channelName: `fm-${channelId}` });
  };
  const list = async (token = cyril) => ((await (await fm.call('GET', '/fm/seances', { token })).json()) as { seances: Summary[] }).seances;
  const read = async (id: string, token = cyril) => (await fm.call('GET', `/fm/seances/${id}`, { token })).json() as Promise<Detail>;
  const commands = async () => ((await (await fm.call('GET', '/fm/bot/commands', { authorization: `Bearer ${BOT_KEY}` })).json()) as { commands: Record<string, unknown>[] }).commands;
  return { fm, cyril, bob, created, session, list, read, commands };
}

describe('GET /fm/seances', () => {
  it('needs a session token', async () => {
    const { fm } = await setup();
    expect((await fm.call('GET', '/fm/seances')).status).toBe(401);
  });

  it('lists the viewer\'s séances: running first, then paused, then archived, with their totals', async () => {
    const { fm, created, session, list, bob } = await setup();
    await created('paused');
    await session('paused', 1000);
    await session('paused', 500);
    await created('running');
    await session('running', 2000, false);
    await created('archived');
    await session('archived', 300);
    await fm.botEvent('channel-archived', { channelId: 'archived', channelName: 'fm-archived' });
    // A séance held in a channel that is not one of the player's own exists by its sessions only.
    await session('ordinary', 700);

    const seances = await list();
    expect(seances.map((seance) => [seance.id, seance.state, seance.discord, seance.totalKamas, seance.sessionCount, seance.captureCount])).toEqual([
      ['running', 'running', 'active', 2000, 1, 1],
      ['paused', 'paused', 'active', 1500, 2, 2],
      ['ordinary', 'archived', 'ordinary', 700, 1, 1],
      ['archived', 'archived', 'archived', 300, 1, 1],
    ]);
    expect(seances[0].name).toBe('fm-running');
    expect(await list(bob)).toEqual([]);
  });
});

describe('GET /fm/seances/{id}', () => {
  it('gives the sessions, their captures and lines, and what the owner may do', async () => {
    const { created, session, read } = await setup();
    await created('c1');
    await session('c1', 15868);
    await session('c1', 15868, false);

    const detail = await read('c1');
    expect(detail).toMatchObject({ id: 'c1', state: 'running', totalKamas: 31736, quantity: 20, canResume: false, canArchive: true, canReopen: false, request: null });
    expect(detail.items).toEqual([{ itemName: 'Rune Do Air', itemId: expect.any(String), quantity: 20, totalKamas: 31736, averageUnitKamas: 1587, corrected: false }]);
    expect(detail.sessions.map((entry) => [entry.status, entry.totalKamas, entry.canStop, entry.captures.length])).toEqual([['open', 15868, true, 1], ['closed', 15868, false, 1]]);
    expect(detail.sessions[0].captures[0]).toMatchObject({ spentKamas: 15868, corrected: false, ignored: [] });
    expect(detail.sessions[0].captures[0].lines).toMatchObject([{ itemName: 'Rune Do Air', quantity: 10, totalKamas: 15868, originalQuantity: 10, originalTotalKamas: 15868, corrected: false }]);
  });

  it('answers another player\'s séance like an unknown one', async () => {
    const { fm, created, session, bob } = await setup();
    await created('c1');
    await session('c1');
    const refused = await fm.call('GET', '/fm/seances/c1', { token: bob });
    expect(refused.status).toBe(404);
    expect(await refused.text()).toBe(await (await fm.call('GET', '/fm/seances/nope', { token: bob })).text());
  });
});

describe('archiving and reopening a séance', () => {
  it('archives at once, closes the open session, and asks the bot to archive the channel', async () => {
    const { fm, cyril, bob, created, session, read, commands } = await setup();
    await created('c1');
    await session('c1', 1000, false);

    expect((await fm.call('POST', '/fm/seances/c1/archive', { token: bob })).status).toBe(404);
    const archived = await fm.call('POST', '/fm/seances/c1/archive', { token: cyril });
    expect(archived.status).toBe(200);
    expect(await archived.json()).toMatchObject({ state: 'archived', discord: 'archived', canArchive: false, canReopen: true, request: { type: 'archive', status: 'pending' } });
    expect(fm.query('SELECT status FROM fm_sessions')).toEqual([{ status: 'closed' }]);
    expect(await commands()).toMatchObject([{ type: 'archive-channel', channelId: 'c1', channelName: 'fm-c1' }]);

    const again = await fm.call('POST', '/fm/seances/c1/archive', { token: cyril });
    expect([again.status, await again.json()]).toEqual([409, { error: 'not-active' }]);
    expect((await read('c1')).totalKamas).toBe(1000);
  });

  it('refuses to archive a séance that has no channel of the player\'s own', async () => {
    const { fm, cyril, session } = await setup();
    await session('ordinary');
    expect((await fm.call('POST', '/fm/seances/ordinary/archive', { token: cyril })).status).toBe(409);
  });

  it('reopens an archived séance with a new session: the bot reopens the channel, then opens the session', async () => {
    const { fm, cyril, created, session, commands } = await setup();
    await created('c1');
    await session('c1');
    expect(await (await fm.call('POST', '/fm/seances/c1/reopen', { token: cyril })).json()).toEqual({ error: 'not-archived' });
    await fm.call('POST', '/fm/seances/c1/archive', { token: cyril });

    const reopened = await fm.call('POST', '/fm/seances/c1/reopen', { token: cyril });
    expect(reopened.status).toBe(200);
    expect(await reopened.json()).toMatchObject({ state: 'running', discord: 'active', sessionCount: 2, request: { type: 'reopen', status: 'pending' } });
    // The archive request still waiting is cancelled: the bot never archives a reopened channel.
    expect((await commands()).map((command) => [command.type, command.channelId])).toEqual([['reopen-channel', 'c1'], ['open', 'c1']]);
    expect((await commands())[0]).toMatchObject({ channelName: 'fm-c1', player: { id: '42', displayName: 'Cyril' } });
  });

  it('follows the bot: a channel it reopened is active again', async () => {
    const { fm, created, list } = await setup();
    await created('c1');
    await fm.botEvent('channel-archived', { channelId: 'c1', channelName: 'fm-c1' });
    expect((await list())[0]).toMatchObject({ discord: 'archived' });
    await fm.botEvent('channel-reopened', { channelId: 'c1', channelName: 'fm-c1' });
    expect((await list())[0]).toMatchObject({ discord: 'active', state: 'paused' });
  });

  it('counts a reopened séance in the limit of 5 active channels', async () => {
    const { fm, cyril, created } = await setup();
    for (const id of ['a', 'b', 'c', 'd', 'e']) await created(id);
    await fm.call('POST', '/fm/seances/a/archive', { token: cyril });
    await created('f');
    const refused = await fm.call('POST', '/fm/seances/a/reopen', { token: cyril });
    expect([refused.status, await refused.json()]).toEqual([409, { error: 'channel-limit' }]);
  });
});

describe('the item of a séance', () => {
  it('chooses, changes and removes the item of a channel of the player\'s own', async () => {
    const { fm, cyril, bob, created, session, read } = await setup();
    await created('c1');
    await session('c1');
    const item = await (await fm.call('POST', '/fm/items', { token: cyril, body: { ...coiffe, itemName: 'Anneau Rtograf', label: 'Rtograf PA' } })).json() as { id: string };

    const chosen = await fm.call('PUT', '/fm/seances/c1/item', { token: cyril, body: { fmItemId: item.id } });
    expect(await chosen.json()).toMatchObject({ fmItem: { id: item.id, name: 'Rtograf PA', itemName: 'Anneau Rtograf', label: 'Rtograf PA', imageUrl: coiffe.imageUrl } });
    expect(fm.query('SELECT fm_item_id FROM fm_channels')).toEqual([{ fm_item_id: item.id }]);

    const created2 = await fm.call('PUT', '/fm/seances/c1/item', { token: cyril, body: { item: coiffe } });
    expect(await created2.json()).toMatchObject({ fmItem: { name: 'Coiffe Bouftou', label: null } });
    expect(fm.query('SELECT COUNT(*) AS n FROM fm_items')).toEqual([{ n: 2 }]);

    expect((await fm.call('DELETE', '/fm/seances/c1/item', { token: bob })).status).toBe(404);
    await fm.call('DELETE', '/fm/seances/c1/item', { token: cyril });
    expect((await read('c1')).fmItem).toBeNull();
  });

  it('carries the item of an ordinary séance on its sessions', async () => {
    const { fm, cyril, session, read } = await setup();
    await session('ordinary');
    await session('ordinary');
    await fm.call('PUT', '/fm/seances/ordinary/item', { token: cyril, body: { item: coiffe } });
    expect((await read('ordinary')).fmItem).toMatchObject({ name: 'Coiffe Bouftou' });
    expect(fm.query<{ fm_item_id: string | null }>('SELECT fm_item_id FROM fm_sessions').every((row) => row.fm_item_id !== null)).toBe(true);
  });

  it('refuses a missing or invalid item, another player\'s item, and an unknown séance', async () => {
    const { fm, cyril, bob, created } = await setup();
    await created('c1');
    const bobItem = await (await fm.call('POST', '/fm/items', { token: bob, body: { ...coiffe, label: null } })).json() as { id: string };
    expect((await fm.call('PUT', '/fm/seances/c1/item', { token: cyril, body: {} })).status).toBe(400);
    expect((await fm.call('PUT', '/fm/seances/c1/item', { token: cyril, body: { item: { ...coiffe, itemId: 'x' } } })).status).toBe(400);
    expect((await fm.call('PUT', '/fm/seances/c1/item', { token: cyril, body: { fmItemId: bobItem.id } })).status).toBe(404);
    expect((await fm.call('PUT', '/fm/seances/nope/item', { token: cyril, body: { item: coiffe } })).status).toBe(404);
  });
});

describe('a new item with a session or a channel (US3)', () => {
  it('creates the item with the session started from the site, as the channel\'s item', async () => {
    const { fm, cyril, created } = await setup();
    await created('c1');
    const started = await fm.call('POST', '/fm/sessions', { token: cyril, body: { channelId: 'c1', item: coiffe } });
    expect(started.status).toBe(201);
    expect(await started.json()).toMatchObject({ fmItem: { name: 'Coiffe Bouftou' }, fmItemSource: 'channel' });
    expect((await fm.call('POST', '/fm/sessions', { token: cyril, body: { channelId: 'c1', item: { ...coiffe, itemName: '' } } })).status).toBe(400);
  });

  it('creates the item with the request for a channel, handed to the bot with it', async () => {
    const { fm, cyril, commands } = await setup();
    const requested = await fm.call('POST', '/fm/channels', { token: cyril, body: { name: 'coiffe', item: coiffe } });
    expect(requested.status).toBe(202);
    expect(await commands()).toMatchObject([{ type: 'create-channel', name: 'coiffe', item: { name: 'Coiffe Bouftou' } }]);
    expect((await fm.call('POST', '/fm/channels', { token: cyril, body: { name: 'coiffe', item: { ...coiffe, imageUrl: 'https://evil.test/a.png' } } })).status).toBe(400);
    expect(fm.query('SELECT COUNT(*) AS n FROM fm_items')).toEqual([{ n: 1 }]);
  });
});
