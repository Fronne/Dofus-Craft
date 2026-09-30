import { beforeEach, describe, expect, it } from 'vitest';
import { clearReadCache } from '../../worker/src/read-cache';
import { createFmWorker, doAirLine } from '../support/fm-worker';

// specs/027-fm-item-recap (contracts/fm-items-api.md): items in FM, attaching sessions, the recap.
beforeEach(() => clearReadCache());

const rtograf = { itemId: '8237', itemName: 'Anneau Rtograf', imageUrl: 'https://api.dofusdb.fr/img/items/9123.png', label: 'Rtograf PA' };

type Item = { id: string; label: string | null; itemName: string; totalKamas: number; sessionCount: number };
type Session = { id: string; totalKamas: number; fmItem: null | { private: true } | { id: string; name: string; owner: { displayName: string } } };
type Recap = Item & { sessions: { id: string; totalKamas: number }[]; items: { itemName: string; quantity: number; totalKamas: number; averageUnitKamas: number }[] };

async function setup() {
  const fm = createFmWorker();
  const cyril = await fm.login('42', { displayName: 'Cyril' });
  const bob = await fm.login('7', { displayName: 'Bob' });
  const createItem = async (token = cyril, body: object = rtograf) => (await fm.call('POST', '/fm/items', { token, body })).json() as Promise<Item>;
  // A session started by `author` with the given lines, then closed; returns its id.
  const session = async (author: string, spent: number, lines = [doAirLine], channelId = `c-${Math.random()}`) => {
    await fm.startSession(author, { channelId });
    const { sessionId } = await (await fm.capture(author, spent, lines, { channelId })).json() as { sessionId: string };
    await fm.botEvent('session-stop', { channelId });
    return sessionId;
  };
  const attach = (sessionId: string, fmItemId: string, token = cyril) => fm.call('PUT', `/fm/sessions/${sessionId}/item`, { token, body: { fmItemId } });
  return { fm, cyril, bob, createItem, session, attach };
}

describe('items in FM (US1)', () => {
  it('creates an item for the logged-in player', async () => {
    const { fm, cyril } = await setup();
    const response = await fm.call('POST', '/fm/items', { token: cyril, body: rtograf });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ itemName: 'Anneau Rtograf', label: 'Rtograf PA', owner: { displayName: 'Cyril' }, totalKamas: 0, sessionCount: 0 });
  });

  it('refuses an invalid equipment, icon or name', async () => {
    const { fm, cyril } = await setup();
    for (const body of [
      { ...rtograf, itemId: 'abc' },
      { ...rtograf, itemName: '' },
      { ...rtograf, itemName: 'x'.repeat(81) },
      { ...rtograf, imageUrl: 'https://evil.test/a.png' },
      { ...rtograf, label: '   ' },
      { ...rtograf, label: 'x'.repeat(41) },
    ]) {
      expect((await fm.call('POST', '/fm/items', { token: cyril, body })).status).toBe(400);
    }
  });

  it('lets only the owner rename or delete an item', async () => {
    const { fm, bob, cyril, createItem } = await setup();
    const item = await createItem();
    expect((await fm.call('PATCH', `/fm/items/${item.id}`, { token: bob, body: { label: 'Volé' } })).status).toBe(404);
    expect((await fm.call('DELETE', `/fm/items/${item.id}`, { token: bob })).status).toBe(404);
    const renamed = await fm.call('PATCH', `/fm/items/${item.id}`, { token: cyril, body: { label: null } });
    expect(await renamed.json()).toMatchObject({ label: null, itemName: 'Anneau Rtograf' });
  });

  it('keeps the sessions of a deleted item, no longer attached', async () => {
    const { fm, cyril, createItem, session, attach } = await setup();
    const item = await createItem();
    const sessionId = await session('42', 1000);
    await attach(sessionId, item.id);
    expect((await fm.call('DELETE', `/fm/items/${item.id}`, { token: cyril })).status).toBe(204);
    expect(fm.query('SELECT fm_item_id FROM fm_sessions WHERE id = ?', sessionId)).toEqual([{ fm_item_id: null }]);
  });
});

describe('attaching a session (US1)', () => {
  it('attaches the player\'s own session, and says so in the session', async () => {
    const { cyril, fm, createItem, session, attach } = await setup();
    const item = await createItem();
    const sessionId = await session('42', 1000);
    const response = await attach(sessionId, item.id);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ fmItem: { id: item.id, name: 'Rtograf PA', owner: { displayName: 'Cyril' } }, canAttach: false, canDetach: true });

    const { sessions } = await (await fm.call('GET', '/fm/sessions', { token: cyril })).json() as { sessions: Session[] };
    expect(sessions[0].fmItem).toMatchObject({ id: item.id, name: 'Rtograf PA' });
  });

  it('says whether the viewer can attach a session', async () => {
    const { cyril, bob, fm, session } = await setup();
    const sessionId = await session('42', 1000);
    expect(await (await fm.call('GET', `/fm/sessions/${sessionId}`, { token: cyril })).json()).toMatchObject({ canAttach: true, canDetach: false, fmItem: null });
    // Bob doesn't see Cyril's session at all (specs/030 FR-002).
    expect((await fm.call('GET', `/fm/sessions/${sessionId}`, { token: bob })).status).toBe(404);
  });

  // specs/030-private-fm-sessions (FR-004): posting in a session no longer lets one attach it.
  it('refuses another player\'s session like an unknown one, even one the player spent in', async () => {
    const { fm, bob, createItem, attach } = await setup();
    const bobItem = await createItem(bob);
    await fm.startSession('42', { channelId: 'shared' });
    const { sessionId } = await (await fm.capture('7', 1000, [doAirLine], { channelId: 'shared' })).json() as { sessionId: string };

    const refused = await attach(sessionId, bobItem.id, bob);
    expect(refused.status).toBe(404);
    expect(await refused.text()).toBe(await (await attach('unknown', bobItem.id, bob)).text());
  });

  it('attaches the player\'s own session even without any purchase', async () => {
    const { fm, createItem, attach } = await setup();
    const item = await createItem();
    await fm.startSession('42', { channelId: 'empty' });
    const [empty] = fm.query<{ id: string }>("SELECT id FROM fm_sessions WHERE channel_id = 'empty'");
    expect((await attach(empty.id, item.id)).status).toBe(200);
  });

  it('refuses another player\'s item, or an unknown session', async () => {
    const { bob, createItem, session, attach } = await setup();
    const cyrilItem = await createItem();
    expect((await attach(await session('7', 1000), cyrilItem.id, bob)).status).toBe(404);
    expect((await attach('unknown', cyrilItem.id)).status).toBe(404);
  });

  it('attaches a session to one item only: the first one wins', async () => {
    const { createItem, session, attach } = await setup();
    const first = await createItem();
    const other = await createItem(undefined, { ...rtograf, label: 'Rtograf PO' });
    const sessionId = await session('42', 1000);

    expect((await attach(sessionId, first.id)).status).toBe(200);
    expect((await attach(sessionId, first.id)).status).toBe(409);
    const second = await attach(sessionId, other.id);
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({ error: 'already-attached' });
  });

  // specs/030 (research R6): another player's session is not found, like an unknown one.
  it('lets only the session\'s owner detach it', async () => {
    const { fm, bob, cyril, createItem, session, attach } = await setup();
    const item = await createItem();
    const sessionId = await session('42', 1000);
    await attach(sessionId, item.id);

    expect((await fm.call('DELETE', `/fm/sessions/${sessionId}/item`, { token: bob })).status).toBe(404);
    const detached = await fm.call('DELETE', `/fm/sessions/${sessionId}/item`, { token: cyril });
    expect(await detached.json()).toMatchObject({ fmItem: null, canAttach: true });
  });
});

// specs/031-fm-session-captures (US2, contracts/fm-session-captures-api.md): attaching a session to an
// equipment typed on the session, which creates the item in the same step.
describe('attaching a session to a new item', () => {
  const coiffe = { itemId: '2411', itemName: 'Coiffe Bouftou', imageUrl: 'https://api.dofusdb.fr/img/items/16010.png' };
  const attachNew = (fm: ReturnType<typeof createFmWorker>, sessionId: string, token: string, item: object = coiffe) =>
    fm.call('PUT', `/fm/sessions/${sessionId}/item`, { token, body: { item } });
  const itemCount = (fm: ReturnType<typeof createFmWorker>) => fm.query<{ n: number }>('SELECT COUNT(*) AS n FROM fm_items')[0].n;

  it('creates the item, without a name of its own, and attaches the session to it', async () => {
    const { fm, cyril, session } = await setup();
    const sessionId = await session('42', 1000);

    const response = await attachNew(fm, sessionId, cyril);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ fmItem: { name: 'Coiffe Bouftou', owner: { displayName: 'Cyril' } }, canAttach: false, canDetach: true });
    const profile = await (await fm.call('GET', '/fm/players/42', { token: cyril })).json() as { fmItems: Item[] };
    expect(profile.fmItems).toMatchObject([{ itemName: 'Coiffe Bouftou', label: null, totalKamas: 1000, sessionCount: 1 }]);
  });

  it('refuses an invalid equipment', async () => {
    const { fm, cyril, session } = await setup();
    const sessionId = await session('42', 1000);
    for (const item of [{ ...coiffe, itemId: 'x' }, { ...coiffe, itemName: '' }, { ...coiffe, imageUrl: 'https://evil.test/a.png' }]) {
      expect((await attachNew(fm, sessionId, cyril, item)).status).toBe(400);
    }
    expect((await fm.call('PUT', `/fm/sessions/${sessionId}/item`, { token: cyril, body: {} })).status).toBe(400);
    expect(itemCount(fm)).toBe(0);
  });

  it('creates nothing for a session already attached, by hand or through its channel', async () => {
    const { fm, cyril, createItem, session, attach } = await setup();
    const item = await createItem();
    const attached = await session('42', 1000);
    await attach(attached, item.id);
    const conflict = await attachNew(fm, attached, cyril);
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({ error: 'already-attached' });

    const inChannel = await session('42', 1000, [doAirLine], 'channel-perso');
    fm.sqlite.prepare("INSERT INTO fm_channels (channel_id, channel_name, owner_discord_user_id, status, fm_item_id, created_at) VALUES ('channel-perso', 'fm-perso', '42', 'active', ?, '2026-09-30T10:00:00.000Z')").run(item.id);
    expect((await attachNew(fm, inChannel, cyril)).status).toBe(409);
    expect(itemCount(fm)).toBe(1);
  });

  // research R4, FR-012: attached by another click between the checks and the batch.
  it('removes the new item again when the session was attached in the meantime', async () => {
    const { fm, cyril, createItem, session } = await setup();
    const item = await createItem();
    const sessionId = await session('42', 1000);
    const batch = fm.d1.batch.bind(fm.d1);
    fm.d1.batch = async (statements) => {
      fm.sqlite.prepare('UPDATE fm_sessions SET fm_item_id = ? WHERE id = ?').run(item.id, sessionId);
      return batch(statements);
    };

    const conflict = await attachNew(fm, sessionId, cyril);
    expect(conflict.status).toBe(409);
    expect(fm.query<{ id: string }>('SELECT id FROM fm_items')).toEqual([{ id: item.id }]);
  });

  it('creates nothing for another player\'s session, answered like an unknown one', async () => {
    const { fm, bob, session } = await setup();
    const sessionId = await session('42', 1000);
    const refused = await attachNew(fm, sessionId, bob);
    expect(refused.status).toBe(404);
    expect(await refused.text()).toBe(await (await attachNew(fm, 'unknown', bob)).text());
    expect(itemCount(fm)).toBe(0);
  });
});

describe('item recap (US2)', () => {
  it('adds up the attached sessions, with each rune over all of them, and no share per player', async () => {
    const { fm, cyril, createItem, session, attach } = await setup();
    const item = await createItem();
    const first = await session('42', 100000, [doAirLine, doAirLine]);
    const second = await session('42', 50000, [{ name: 'Rune Do Air', qty: 10, price: 16000 }]);
    await attach(first, item.id);
    await attach(second, item.id);

    const recap = await (await fm.call('GET', `/fm/items/${item.id}`, { token: cyril })).json() as Recap;
    const sessionTotals = await Promise.all([first, second].map(async (id) => ((await (await fm.call('GET', `/fm/sessions/${id}`, { token: cyril })).json()) as Session).totalKamas));
    expect(recap.totalKamas).toBe(150000);
    expect(recap.totalKamas).toBe(sessionTotals[0] + sessionTotals[1]);
    expect(recap.sessionCount).toBe(2);
    expect(recap.sessions.map((entry) => [entry.id, entry.totalKamas])).toEqual([[second, 50000], [first, 100000]]);
    expect(recap.items).toEqual([{ itemName: 'Rune Do Air', itemId: '11663', quantity: 30, totalKamas: 47736, averageUnitKamas: 1591 }]);
    expect(JSON.stringify(recap)).not.toContain('players');
  });

  it('is empty for an item without session', async () => {
    const { fm, cyril, createItem } = await setup();
    const item = await createItem();
    expect(await (await fm.call('GET', `/fm/items/${item.id}`, { token: cyril })).json()).toMatchObject({ totalKamas: 0, sessions: [], items: [] });
  });

  it('follows the bot: a new purchase adds up, a reset brings the session back to 0', async () => {
    const { fm, cyril, createItem, attach } = await setup();
    const item = await createItem();
    await fm.startSession('42', { channelId: 'live' });
    const { sessionId } = await (await fm.capture('42', 1000, [doAirLine], { channelId: 'live' })).json() as { sessionId: string };
    await attach(sessionId, item.id);
    await fm.capture('42', 2000, [doAirLine], { channelId: 'live' });
    const recap = () => fm.call('GET', `/fm/items/${item.id}`, { token: cyril }).then((response) => response.json() as Promise<Recap>);
    expect((await recap()).totalKamas).toBe(3000);
    await fm.botEvent('session-reset', { channelId: 'live' });
    expect((await recap()).totalKamas).toBe(0);
  });
});

describe('visibility (US3)', () => {
  it('lists a player\'s items on their profile, newest first, with their totals', async () => {
    const { fm, cyril, createItem, session, attach } = await setup();
    const older = await createItem();
    await attach(await session('42', 1000), older.id);
    fm.sqlite.prepare("UPDATE fm_items SET created_at = '2026-01-01T00:00:00.000Z' WHERE id = ?").run(older.id);
    const newer = await createItem(undefined, { ...rtograf, label: 'Rtograf PO' });

    const profile = await (await fm.call('GET', '/fm/players/42', { token: cyril })).json() as { fmItems: Item[] };
    expect(profile.fmItems.map((item) => [item.id, item.totalKamas, item.sessionCount])).toEqual([[newer.id, 0, 0], [older.id, 1000, 1]]);
  });

  // specs/030-private-fm-sessions (FR-007): public or private, only the owner sees an item.
  it('hides an owner\'s items from the others, public or private, but not from the owner', async () => {
    const { fm, bob, cyril, createItem, session, attach } = await setup();
    const item = await createItem();
    const sessionId = await session('42', 1000);
    await attach(sessionId, item.id);

    const unknown = await (await fm.call('GET', '/fm/items/unknown', { token: bob })).text();
    const seenByBob = await fm.call('GET', `/fm/items/${item.id}`, { token: bob });
    expect(seenByBob.status).toBe(404);
    expect(await seenByBob.text()).toBe(unknown);
    expect((await fm.call('GET', `/fm/sessions/${sessionId}`, { token: bob })).status).toBe(404);
    const { sessions } = await (await fm.call('GET', '/fm/sessions', { token: bob })).json() as { sessions: Session[] };
    expect(JSON.stringify(sessions)).not.toContain('Rtograf');
    await fm.call('PATCH', '/fm/me', { token: cyril, body: { isPrivate: true } });

    expect((await fm.call('GET', `/fm/items/${item.id}`, { token: cyril })).status).toBe(200);
    const seenByCyril = await (await fm.call('GET', `/fm/sessions/${sessionId}`, { token: cyril })).json() as Session;
    expect(seenByCyril.fmItem).toMatchObject({ id: item.id, name: 'Rtograf PA' });
  });

  it('deletes the items of a deleted profile and detaches their sessions', async () => {
    const { fm, cyril, createItem, session, attach } = await setup();
    const item = await createItem();
    const sessionId = await session('7', 1000);
    await fm.startSession('42', { channelId: 'mine' });
    const { sessionId: mine } = await (await fm.capture('42', 1000, [doAirLine], { channelId: 'mine' })).json() as { sessionId: string };
    await attach(mine, item.id);

    expect((await fm.call('DELETE', '/fm/me', { token: cyril })).status).toBe(204);
    expect(fm.query('SELECT COUNT(*) AS n FROM fm_items')).toEqual([{ n: 0 }]);
    expect(fm.query('SELECT COUNT(*) AS n FROM fm_sessions WHERE fm_item_id IS NOT NULL')).toEqual([{ n: 0 }]);
    expect(fm.query('SELECT COUNT(*) AS n FROM fm_sessions WHERE id IN (?, ?)', sessionId, mine)).toEqual([{ n: 2 }]);
  });
});
