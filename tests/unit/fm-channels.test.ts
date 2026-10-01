import { beforeEach, describe, expect, it } from 'vitest';
import { clearReadCache } from '../../worker/src/read-cache';
import { BOT_KEY, createFmWorker, doAirLine } from '../support/fm-worker';

// specs/029-channel-ownership (contracts/fm-channels-api.md): personal FM channels created by the bot.
beforeEach(() => clearReadCache());

const cyrilAuthor = { id: '42', displayName: 'Cyril', avatarUrl: null };
type Channel = { channelId: string; channelName: string; status: string; busy?: boolean; fmItem: { id: string; name: string } | null };

async function setup() {
  const fm = createFmWorker();
  const cyril = await fm.login('42', { displayName: 'Cyril' });
  const bob = await fm.login('7', { displayName: 'Bob' });
  const created = (channelId: string, author = cyrilAuthor, fields: object = {}) =>
    fm.botEvent('channel-created', { channelId, channelName: `fm-${channelId}`, author, ...fields });
  const myChannels = async (token = cyril) => ((await (await fm.call('GET', '/fm/channels', { token })).json()) as { channels: Channel[] }).channels;
  const item = async (token = cyril, label = 'Rtograf PA') =>
    (await (await fm.call('POST', '/fm/items', { token, body: { itemId: '8237', itemName: 'Anneau Rtograf', imageUrl: null, label } })).json()) as { id: string };
  const commands = async () => ((await (await fm.call('GET', '/fm/bot/commands', { authorization: `Bearer ${BOT_KEY}` })).json()) as { commands: Record<string, unknown>[] }).commands;
  const ack = (id: string, body: object) => fm.call('POST', `/fm/bot/commands/${id}/ack`, { authorization: `Bearer ${BOT_KEY}`, body });
  // A session of Cyril in a channel, with one capture, closed.
  const session = async (channelId: string, spent = 15868) => {
    await fm.botEvent('session-start', { channelId, channelName: `fm-${channelId}`, author: cyrilAuthor });
    const { sessionId } = await (await fm.capture('42', spent, [doAirLine], { channelId, channelName: `fm-${channelId}` })).json() as { sessionId: string };
    await fm.botEvent('session-stop', { channelId, channelName: `fm-${channelId}` });
    return sessionId;
  };
  return { fm, cyril, bob, created, myChannels, item, commands, ack, session };
}

describe('channels sent by the bot (FR-007, FR-008)', () => {
  it('records a created channel as its author\'s, then archives and deletes it', async () => {
    const { fm, created, myChannels } = await setup();
    expect((await created('c1')).status).toBe(200);
    expect(await myChannels()).toEqual([{ channelId: 'c1', channelName: 'fm-c1', status: 'active', fmItem: null, busy: false }]);

    await fm.botEvent('channel-archived', { channelId: 'c1', channelName: 'fm-c1' });
    expect(await myChannels()).toEqual([]);
    expect(fm.query('SELECT status FROM fm_channels')).toEqual([{ status: 'archived' }]);
    await fm.botEvent('channel-deleted', { channelId: 'c1', channelName: 'fm-c1' });
    expect(fm.query('SELECT status FROM fm_channels')).toEqual([{ status: 'deleted' }]);
  });

  it('refuses a created channel without author, and ignores a resend', async () => {
    const { fm, created } = await setup();
    expect((await fm.botEvent('channel-created', { channelId: 'c1', channelName: 'fm-c1' })).status).toBe(400);
    const body = { channelId: 'c2', channelName: 'fm-c2', author: cyrilAuthor, eventId: 'same' };
    await fm.botEvent('channel-created', body);
    expect(await (await fm.botEvent('channel-created', { ...body, channelName: 'renamed' })).json()).toMatchObject({ duplicate: true });
    expect(fm.query("SELECT channel_name FROM fm_channels WHERE channel_id = 'c2'")).toEqual([{ channel_name: 'fm-c2' }]);
    expect((await created('c3')).status).toBe(200);
  });
});

describe('starting from the site (FR-009, FR-010)', () => {
  it('offers only the player\'s own active channels', async () => {
    const { fm, bob, created, myChannels } = await setup();
    await created('mine');
    await created('bobs', { id: '7', displayName: 'Bob', avatarUrl: null });
    await created('archived');
    await fm.botEvent('channel-archived', { channelId: 'archived', channelName: 'fm-archived' });
    await fm.botEvent('session-start', { channelId: 'old', channelName: 'fm-old' });
    expect((await myChannels()).map((channel) => channel.channelId)).toEqual(['mine']);
    expect((await myChannels(bob)).map((channel) => channel.channelId)).toEqual(['bobs']);
  });

  it('refuses a session in another player\'s channel, an archived one, or an ordinary old one', async () => {
    const { fm, cyril, created } = await setup();
    await created('bobs', { id: '7', displayName: 'Bob', avatarUrl: null });
    await created('archived');
    await fm.botEvent('channel-archived', { channelId: 'archived', channelName: 'fm-archived' });
    await fm.botEvent('session-start', { channelId: 'old', channelName: 'fm-old' });
    await fm.botEvent('session-stop', { channelId: 'old', channelName: 'fm-old' });
    for (const channelId of ['bobs', 'archived', 'old']) {
      const response = await fm.call('POST', '/fm/sessions', { token: cyril, body: { channelId } });
      expect(response.status).toBe(403);
    }
    expect(fm.query("SELECT COUNT(*) AS n FROM fm_bot_commands")).toEqual([{ n: 0 }]);
  });

  it('asks the bot to create a channel, and follows the request until the session is open', async () => {
    const { fm, cyril, item, commands, ack } = await setup();
    const rtograf = await item();
    const response = await fm.call('POST', '/fm/channels', { token: cyril, body: { name: 'mon rtograf', fmItemId: rtograf.id } });
    expect(response.status).toBe(202);
    const { requestId } = await response.json() as { requestId: string };
    expect(await commands()).toEqual([{ id: requestId, type: 'create-channel', guildId: 'guild-1', name: 'mon rtograf', player: { id: '42', displayName: 'Cyril' }, item: { name: 'Rtograf PA' } }]);
    expect(await (await fm.call('GET', `/fm/channel-requests/${requestId}`, { token: cyril })).json()).toMatchObject({ status: 'pending', channelId: null, sessionId: null });

    // What the bot does: create the channel, say so, open its session, acknowledge.
    await fm.botEvent('channel-created', { channelId: 'c-new', channelName: 'fm-cyril-mon-rtograf', author: cyrilAuthor, commandId: requestId });
    const { sessionId } = await (await fm.botEvent('session-start', { channelId: 'c-new', channelName: 'fm-cyril-mon-rtograf', author: cyrilAuthor })).json() as { sessionId: string };
    await ack(requestId, { status: 'done', channelId: 'c-new' });

    expect(await (await fm.call('GET', `/fm/channel-requests/${requestId}`, { token: cyril })).json())
      .toEqual({ id: requestId, status: 'done', error: null, channelId: 'c-new', sessionId });
    expect(fm.query("SELECT fm_item_id FROM fm_channels WHERE channel_id = 'c-new'")).toEqual([{ fm_item_id: rtograf.id }]);
    expect(await commands()).toEqual([]);
  });

  it('shows the reason a creation failed, and hides another player\'s request', async () => {
    const { fm, cyril, bob, commands, ack } = await setup();
    const { requestId } = await (await fm.call('POST', '/fm/channels', { token: cyril, body: { name: 'x' } })).json() as { requestId: string };
    expect((await commands())[0].item).toBeNull();
    await ack(requestId, { status: 'failed', error: 'Catégorie introuvable' });
    expect(await (await fm.call('GET', `/fm/channel-requests/${requestId}`, { token: cyril })).json()).toMatchObject({ status: 'failed', error: 'Catégorie introuvable' });
    expect((await fm.call('GET', `/fm/channel-requests/${requestId}`, { token: bob })).status).toBe(404);
  });

  it('refuses an invalid name or another player\'s item', async () => {
    const { fm, cyril, bob, item } = await setup();
    for (const name of ['', '   ', 'x'.repeat(31)]) {
      expect((await fm.call('POST', '/fm/channels', { token: cyril, body: { name } })).status).toBe(400);
    }
    const bobItem = await item(bob);
    expect((await fm.call('POST', '/fm/channels', { token: cyril, body: { name: 'ok', fmItemId: bobItem.id } })).status).toBe(404);
  });

  it('caps a player at 5 active channels, counting requests still waiting', async () => {
    const { fm, cyril, created } = await setup();
    for (const channelId of ['a', 'b', 'c']) await created(channelId);
    for (const name of ['d', 'e']) expect((await fm.call('POST', '/fm/channels', { token: cyril, body: { name } })).status).toBe(202);
    const sixth = await fm.call('POST', '/fm/channels', { token: cyril, body: { name: 'f' } });
    expect(sixth.status).toBe(409);
    expect(await sixth.json()).toEqual({ error: 'channel-limit' });

    await fm.botEvent('channel-archived', { channelId: 'a', channelName: 'fm-a' });
    expect((await fm.call('POST', '/fm/channels', { token: cyril, body: { name: 'f' } })).status).toBe(202);
  });
});

describe('a whole channel attached to an item (FR-011 to FR-013)', () => {
  it('counts the channel\'s past and future sessions for the item', async () => {
    const { fm, cyril, created, item, session } = await setup();
    await created('c1');
    const rtograf = await item();
    const past = await session('c1', 100000);

    const attached = await fm.call('PUT', '/fm/channels/c1/item', { token: cyril, body: { fmItemId: rtograf.id } });
    expect(await attached.json()).toMatchObject({ channelId: 'c1', fmItem: { id: rtograf.id, name: 'Rtograf PA' } });
    const future = await session('c1', 50000);

    const recap = await (await fm.call('GET', `/fm/items/${rtograf.id}`, { token: cyril })).json() as { totalKamas: number; sessionCount: number; sessions: { id: string }[] };
    expect(recap).toMatchObject({ totalKamas: 150000, sessionCount: 2 });
    expect(recap.sessions.map((entry) => entry.id).sort()).toEqual([past, future].sort());
    expect(await (await fm.call('GET', `/fm/sessions/${past}`, { token: cyril })).json())
      .toMatchObject({ fmItem: { id: rtograf.id }, fmItemSource: 'channel', canAttach: false, canDetach: false });
  });

  it('keeps a session attached by hand to its own item', async () => {
    const { fm, cyril, created, item, session } = await setup();
    await created('c1');
    const pa = await item(cyril, 'Rtograf PA');
    const po = await item(cyril, 'Rtograf PO');
    const byHand = await session('c1');
    await fm.call('PUT', `/fm/sessions/${byHand}/item`, { token: cyril, body: { fmItemId: po.id } });
    await fm.call('PUT', '/fm/channels/c1/item', { token: cyril, body: { fmItemId: pa.id } });

    expect(await (await fm.call('GET', `/fm/sessions/${byHand}`, { token: cyril })).json()).toMatchObject({ fmItem: { id: po.id }, fmItemSource: 'session' });
    expect(await (await fm.call('GET', `/fm/items/${pa.id}`, { token: cyril })).json()).toMatchObject({ sessionCount: 0 });
    expect(await (await fm.call('GET', `/fm/items/${po.id}`, { token: cyril })).json()).toMatchObject({ sessionCount: 1 });
  });

  it('detaches a channel, and lets only its owner change it', async () => {
    const { fm, cyril, bob, created, item, session } = await setup();
    await created('c1');
    const rtograf = await item();
    await session('c1');
    // specs/030-private-fm-sessions (FR-008): another player's channel is not found.
    expect((await fm.call('PUT', '/fm/channels/c1/item', { token: bob, body: { fmItemId: null } })).status).toBe(404);
    await fm.call('PUT', '/fm/channels/c1/item', { token: cyril, body: { fmItemId: rtograf.id } });
    await fm.call('PUT', '/fm/channels/c1/item', { token: cyril, body: { fmItemId: null } });
    expect(await (await fm.call('GET', `/fm/items/${rtograf.id}`, { token: cyril })).json()).toMatchObject({ sessionCount: 0 });
  });

  // specs/030 FR-008: the channels show on their owner's profile only, public or private.
  it('lists a player\'s channels on their own profile, hidden from the others', async () => {
    const { fm, cyril, bob, created } = await setup();
    await created('c1');
    await created('c2');
    await fm.botEvent('channel-archived', { channelId: 'c2', channelName: 'fm-c2' });
    const profile = await (await fm.call('GET', '/fm/players/42', { token: cyril })).json() as { fmChannels: Channel[] };
    expect(profile.fmChannels.map((channel) => [channel.channelId, channel.status])).toEqual([['c1', 'active'], ['c2', 'archived']]);
    expect((await fm.call('GET', '/fm/players/42', { token: bob })).status).toBe(404);
  });

  it('keeps the channels and their sessions when the owner deletes their profile', async () => {
    const { fm, cyril, created, item, session } = await setup();
    await created('c1');
    const rtograf = await item();
    await fm.call('PUT', '/fm/channels/c1/item', { token: cyril, body: { fmItemId: rtograf.id } });
    await session('c1');
    expect((await fm.call('DELETE', '/fm/me', { token: cyril })).status).toBe(204);
    expect(fm.query('SELECT owner_discord_user_id, fm_item_id FROM fm_channels')).toEqual([{ owner_discord_user_id: null, fm_item_id: null }]);
    expect(fm.query('SELECT COUNT(*) AS n FROM fm_sessions')).toEqual([{ n: 1 }]);
  });

  it('frees the channel of a deleted item', async () => {
    const { fm, cyril, created, item } = await setup();
    await created('c1');
    const rtograf = await item();
    await fm.call('PUT', '/fm/channels/c1/item', { token: cyril, body: { fmItemId: rtograf.id } });
    await fm.call('DELETE', `/fm/items/${rtograf.id}`, { token: cyril });
    expect(fm.query('SELECT fm_item_id FROM fm_channels')).toEqual([{ fm_item_id: null }]);
  });
});
