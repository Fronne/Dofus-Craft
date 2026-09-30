import { beforeEach, describe, expect, it } from 'vitest';
import { clearReadCache } from '../../worker/src/read-cache';
import { createFmWorker, doAirLine } from '../support/fm-worker';

// specs/025-rune-purchase-import (US2, US3, contracts/fm-site-api.md): sessions and players as the site
// reads them, with private players masked by the Worker.
beforeEach(() => clearReadCache());

type SessionAnswer = {
  id: string;
  status: string;
  totalKamas: number;
  players: { player: { discordUserId: string | null; displayName: string | null; private: boolean }; spentKamas: number }[];
  channelName?: string;
  items?: { itemName: string; itemId: string | null; quantity: number; totalKamas: number; averageUnitKamas: number }[];
};

// Alice started the session; Bob posted a capture in it too (a channel that isn't a personal one).
async function sessionWithTwoPlayers() {
  const fm = createFmWorker();
  const token = await fm.login('1', { displayName: 'Alice' });
  await fm.login('2', { displayName: 'Bob' });
  await fm.startSession('1');
  await fm.capture('1', 63472, [doAirLine, doAirLine, doAirLine, doAirLine]);
  await fm.capture('2', 5000, [{ name: 'Rune Fo', qty: 10, price: 4000 }]);
  return { fm, token };
}

const listSessions = async (fm: ReturnType<typeof createFmWorker>, token: string) =>
  (await (await fm.call('GET', '/fm/sessions', { token })).json() as { sessions: SessionAnswer[] }).sessions;

describe('GET /fm/sessions', () => {
  it('needs a session token', async () => {
    const fm = createFmWorker();
    expect((await fm.call('GET', '/fm/sessions')).status).toBe(401);
    expect((await fm.call('GET', '/fm/sessions', { token: 'unknown' })).status).toBe(401);
  });

  it('gives each session its total and each player\'s spending, as the bot counted them', async () => {
    const { fm, token } = await sessionWithTwoPlayers();
    const sessions = await listSessions(fm, token);

    expect(sessions).toHaveLength(1);
    // The bot's spending (5 000) wins over the sum of the lines (4 000): FR-011.
    expect(sessions[0]).toMatchObject({ status: 'open', totalKamas: 68472 });
    expect(sessions[0].players.map((row) => [row.player.displayName, row.spentKamas])).toEqual([['Alice', 63472], ['Bob', 5000]]);
  });

  it('pages sessions by 20, most recent first', async () => {
    const fm = createFmWorker();
    const token = await fm.login('1');
    for (let index = 0; index < 21; index += 1) await fm.startSession('1');
    const first = await (await fm.call('GET', '/fm/sessions', { token })).json() as { sessions: { openedAt: string }[]; nextBefore: string };
    expect(first.sessions).toHaveLength(20);
    expect(first.sessions[0].openedAt > first.sessions[19].openedAt).toBe(true);

    const second = await (await fm.call('GET', `/fm/sessions?before=${encodeURIComponent(first.nextBefore)}`, { token })).json() as { sessions: unknown[]; nextBefore: string | null };
    expect(second.sessions).toHaveLength(1);
    expect(second.nextBefore).toBeNull();
  });

  // specs/030-private-fm-sessions (FR-001, FR-003).
  it('lists only the sessions the viewer started: not another player\'s, not one without an owner', async () => {
    const { fm, token } = await sessionWithTwoPlayers();
    await fm.startSession('2', { channelId: 'channel-2', channelName: 'fm-bob' });
    await fm.botEvent('session-start', { channelId: 'channel-3', channelName: 'fm-ancien' });

    expect((await listSessions(fm, token)).map((session) => session.channelName)).toEqual(['fm-coiffe']);
    // Bob posted in Alice's session, but it isn't his.
    expect((await listSessions(fm, 'token-2')).map((session) => session.channelName)).toEqual(['fm-bob']);
  });
});

describe('GET /fm/sessions/{id}', () => {
  it('details each item with its quantity, total and rounded average price, largest total first', async () => {
    const { fm, token } = await sessionWithTwoPlayers();
    const [session] = await listSessions(fm, token);
    const detail = await (await fm.call('GET', `/fm/sessions/${session.id}`, { token })).json() as SessionAnswer;

    expect(detail.items).toEqual([
      { itemName: 'Rune Do Air', itemId: '11663', quantity: 40, totalKamas: 63472, averageUnitKamas: 1587 },
      { itemName: 'Rune Fo', itemId: '1519', quantity: 10, totalKamas: 4000, averageUnitKamas: 400 },
    ]);
  });

  it('answers 404 for an unknown session', async () => {
    const fm = createFmWorker();
    const token = await fm.login('1');
    expect((await fm.call('GET', '/fm/sessions/nope', { token })).status).toBe(404);
  });

  // specs/030 FR-002, FR-003, SC-003: exactly what an unknown session answers.
  it('answers another player\'s session, or one without an owner, like an unknown one', async () => {
    const { fm, token } = await sessionWithTwoPlayers();
    const [session] = await listSessions(fm, token);
    await fm.botEvent('session-start', { channelId: 'channel-3', channelName: 'fm-ancien' });
    const [ownerless] = fm.query<{ id: string }>('SELECT id FROM fm_sessions WHERE owner_discord_user_id IS NULL');

    const unknown = await fm.call('GET', '/fm/sessions/nope', { token: 'token-2' });
    const others = await fm.call('GET', `/fm/sessions/${session.id}`, { token: 'token-2' });
    const noOwner = await fm.call('GET', `/fm/sessions/${ownerless.id}`, { token });
    expect([others.status, noOwner.status]).toEqual([404, 404]);
    const body = await unknown.text();
    expect(await others.text()).toBe(body);
    expect(await noOwner.text()).toBe(body);
  });
});

describe('private players', () => {
  it('are masked in the owner\'s session, but still counted in the total', async () => {
    const { fm, token } = await sessionWithTwoPlayers();
    await fm.call('PATCH', '/fm/me', { token: 'token-2', body: { isPrivate: true } });

    const sessions = await listSessions(fm, token);
    expect(sessions[0].totalKamas).toBe(68472);
    expect(sessions[0].players[1]).toEqual({ player: { discordUserId: null, displayName: null, avatarUrl: null, private: true }, spentKamas: 5000 });

    const detail = await (await fm.call('GET', `/fm/sessions/${sessions[0].id}`, { token })).json() as SessionAnswer;
    expect(detail.players[1].player.displayName).toBeNull();
  });

  it('see themselves normally', async () => {
    const { fm, token } = await sessionWithTwoPlayers();
    await fm.call('PATCH', '/fm/me', { token, body: { isPrivate: true } });
    const sessions = await listSessions(fm, token);
    expect(sessions[0].players[0].player).toMatchObject({ discordUserId: '1', displayName: 'Alice', private: true });
  });

  it('become visible again, on past sessions too, as soon as they go public', async () => {
    const { fm, token } = await sessionWithTwoPlayers();
    await fm.call('PATCH', '/fm/me', { token: 'token-2', body: { isPrivate: true } });
    await fm.call('PATCH', '/fm/me', { token: 'token-2', body: { isPrivate: false } });
    const sessions = await listSessions(fm, token);
    expect(sessions[0].players[1].player.displayName).toBe('Bob');
  });
});

// specs/030-private-fm-sessions (FR-005, FR-006, research R5).
describe('profiles', () => {
  it('list no one but the viewer, and another player\'s profile is not found, public or private', async () => {
    const { fm, token } = await sessionWithTwoPlayers();

    const { players } = await (await fm.call('GET', '/fm/players', { token })).json() as { players: { displayName: string }[] };
    expect(players.map((player) => player.displayName)).toEqual(['Alice']);
    const unknown = await fm.call('GET', '/fm/players/nope', { token });
    const bob = await fm.call('GET', '/fm/players/2', { token });
    expect(bob.status).toBe(404);
    expect(await bob.text()).toBe(await unknown.text());

    await fm.call('PATCH', '/fm/me', { token: 'token-2', body: { isPrivate: true } });
    expect((await fm.call('GET', '/fm/players/2', { token })).status).toBe(404);
    expect((await fm.call('GET', '/fm/players/2', { token: 'token-2' })).status).toBe(200);
  });

  it('count the player\'s own captures, and open only the sessions they own', async () => {
    const { fm, token } = await sessionWithTwoPlayers();
    type Profile = { totalKamas: number; sessions: { spentKamas: number; canOpen: boolean }[] };

    const alice = await (await fm.call('GET', '/fm/players/1', { token })).json() as Profile;
    expect(alice.totalKamas).toBe(63472);
    expect(alice.sessions.map((session) => [session.spentKamas, session.canOpen])).toEqual([[63472, true]]);

    // Bob's 5 000 kamas count for him, but the session is Alice's.
    const bob = await (await fm.call('GET', '/fm/players/2', { token: 'token-2' })).json() as Profile;
    expect(bob.totalKamas).toBe(5000);
    expect(bob.sessions.map((session) => [session.spentKamas, session.canOpen])).toEqual([[5000, false]]);
  });
});
