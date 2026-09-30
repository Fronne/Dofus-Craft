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
  items?: { itemName: string; itemId: string | null; quantity: number; totalKamas: number; averageUnitKamas: number }[];
};

async function sessionWithTwoPlayers() {
  const fm = createFmWorker();
  const token = await fm.login('1', { displayName: 'Alice' });
  await fm.login('2', { displayName: 'Bob' });
  await fm.botEvent('session-start');
  await fm.capture('1', 63472, [doAirLine, doAirLine, doAirLine, doAirLine]);
  await fm.capture('2', 5000, [{ name: 'Rune Fo', qty: 10, price: 4000 }]);
  return { fm, token };
}

describe('GET /fm/sessions', () => {
  it('needs a session token', async () => {
    const fm = createFmWorker();
    expect((await fm.call('GET', '/fm/sessions')).status).toBe(401);
    expect((await fm.call('GET', '/fm/sessions', { token: 'unknown' })).status).toBe(401);
  });

  it('gives each session its total and each player\'s spending, as the bot counted them', async () => {
    const { fm, token } = await sessionWithTwoPlayers();
    const { sessions } = await (await fm.call('GET', '/fm/sessions', { token })).json() as { sessions: SessionAnswer[] };

    expect(sessions).toHaveLength(1);
    // The bot's spending (5 000) wins over the sum of the lines (4 000): FR-011.
    expect(sessions[0]).toMatchObject({ status: 'open', totalKamas: 68472 });
    expect(sessions[0].players.map((row) => [row.player.displayName, row.spentKamas])).toEqual([['Alice', 63472], ['Bob', 5000]]);
  });

  it('pages sessions by 20, most recent first', async () => {
    const fm = createFmWorker();
    const token = await fm.login('1');
    for (let index = 0; index < 21; index += 1) await fm.botEvent('session-start');
    const first = await (await fm.call('GET', '/fm/sessions', { token })).json() as { sessions: { openedAt: string }[]; nextBefore: string };
    expect(first.sessions).toHaveLength(20);
    expect(first.sessions[0].openedAt > first.sessions[19].openedAt).toBe(true);

    const second = await (await fm.call('GET', `/fm/sessions?before=${encodeURIComponent(first.nextBefore)}`, { token })).json() as { sessions: unknown[]; nextBefore: string | null };
    expect(second.sessions).toHaveLength(1);
    expect(second.nextBefore).toBeNull();
  });
});

describe('GET /fm/sessions/{id}', () => {
  it('details each item with its quantity, total and rounded average price, largest total first', async () => {
    const { fm, token } = await sessionWithTwoPlayers();
    const { sessions } = await (await fm.call('GET', '/fm/sessions', { token })).json() as { sessions: SessionAnswer[] };
    const detail = await (await fm.call('GET', `/fm/sessions/${sessions[0].id}`, { token })).json() as SessionAnswer;

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
});

describe('private players', () => {
  it('are masked for other members, but still counted in the total', async () => {
    const { fm, token } = await sessionWithTwoPlayers();
    await fm.call('PATCH', '/fm/me', { token: 'token-2', body: { isPrivate: true } });

    const { sessions } = await (await fm.call('GET', '/fm/sessions', { token })).json() as { sessions: SessionAnswer[] };
    expect(sessions[0].totalKamas).toBe(68472);
    expect(sessions[0].players[1]).toEqual({ player: { discordUserId: null, displayName: null, avatarUrl: null, private: true }, spentKamas: 5000 });

    const detail = await (await fm.call('GET', `/fm/sessions/${sessions[0].id}`, { token })).json() as SessionAnswer;
    expect(detail.players[1].player.displayName).toBeNull();
  });

  it('see themselves normally', async () => {
    const { fm } = await sessionWithTwoPlayers();
    await fm.call('PATCH', '/fm/me', { token: 'token-2', body: { isPrivate: true } });
    const { sessions } = await (await fm.call('GET', '/fm/sessions', { token: 'token-2' })).json() as { sessions: SessionAnswer[] };
    expect(sessions[0].players[1].player).toMatchObject({ discordUserId: '2', displayName: 'Bob', private: true });
  });

  it('are left out of the players list and their profile is not found, except for themselves', async () => {
    const { fm, token } = await sessionWithTwoPlayers();
    await fm.call('PATCH', '/fm/me', { token: 'token-2', body: { isPrivate: true } });

    const { players } = await (await fm.call('GET', '/fm/players', { token })).json() as { players: { displayName: string }[] };
    expect(players.map((player) => player.displayName)).toEqual(['Alice']);
    expect((await fm.call('GET', '/fm/players/2', { token })).status).toBe(404);

    const own = await (await fm.call('GET', '/fm/players', { token: 'token-2' })).json() as { players: { displayName: string }[] };
    expect(own.players.map((player) => player.displayName)).toContain('Bob');
    expect((await fm.call('GET', '/fm/players/2', { token: 'token-2' })).status).toBe(200);
  });

  it('become visible again, on past sessions too, as soon as they go public', async () => {
    const { fm, token } = await sessionWithTwoPlayers();
    await fm.call('PATCH', '/fm/me', { token: 'token-2', body: { isPrivate: true } });
    await fm.call('PATCH', '/fm/me', { token: 'token-2', body: { isPrivate: false } });
    const { sessions } = await (await fm.call('GET', '/fm/sessions', { token })).json() as { sessions: SessionAnswer[] };
    expect(sessions[0].players[1].player.displayName).toBe('Bob');
  });
});
