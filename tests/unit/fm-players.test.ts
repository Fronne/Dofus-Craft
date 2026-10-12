import { beforeEach, describe, expect, it } from 'vitest';
import { clearReadCache } from '../../worker/src/read-cache';
import { createFmWorker, doAirLine } from '../support/fm-worker';

// specs/045-restore-production-worker (US5, contracts/api.md « Joueurs »): the group's players who spent
// or held a séance de FM.
beforeEach(() => clearReadCache());

type Player = {
  displayName: string; avatarUrl: string | null; isMe: boolean; private: boolean; totalKamas: number; seanceCount: number; lastActivityAt: string | null;
  seances: { name: string; state: string; fmItem: { name: string; imageUrl: string | null } | null; totalKamas: number; sessionCount: number }[];
};

async function setup() {
  const fm = createFmWorker();
  const cyril = await fm.login('42', { displayName: 'Cyril' });
  const bob = await fm.login('7', { displayName: 'Bob' });
  const alice = await fm.login('9', { displayName: 'Alice', isPrivate: true });
  await fm.login('11', { displayName: 'Dan' });
  const spend = async (playerId: string, spent: number, channelId: string) => {
    await fm.startSession(playerId, { channelId, channelName: `fm-${channelId}` });
    await fm.capture(playerId, spent, [doAirLine], { channelId, channelName: `fm-${channelId}` });
  };
  const players = async (token: string) => ((await (await fm.call('GET', '/fm/players', { token })).json()) as { players: Player[] }).players;
  return { fm, cyril, bob, alice, spend, players };
}

describe('GET /fm/players', () => {
  it('needs a session token', async () => {
    const { fm } = await setup();
    expect((await fm.call('GET', '/fm/players')).status).toBe(401);
  });

  it('lists the public players who did something, the biggest spender first, without any Discord id', async () => {
    const { fm, cyril, spend, players } = await setup();
    await spend('42', 1000, 'c-cyril');
    await spend('7', 5000, 'c-bob');
    await spend('9', 9000, 'c-alice');

    const list = await players(cyril);
    expect(list.map((player) => [player.displayName, player.totalKamas, player.isMe, player.private, player.seanceCount])).toEqual([
      ['Bob', 5000, false, false, 1],
      ['Cyril', 1000, true, false, 1],
    ]);
    expect(list[0].lastActivityAt).not.toBeNull();
    expect(JSON.stringify(list)).not.toMatch(/discord|"id"/i);
    expect(fm.query('SELECT COUNT(*) AS n FROM fm_players')).toEqual([{ n: 4 }]);
  });

  it('shows a private player to themselves only', async () => {
    const { alice, spend, players } = await setup();
    await spend('7', 5000, 'c-bob');
    await spend('9', 9000, 'c-alice');
    expect((await players(alice)).map((player) => [player.displayName, player.isMe, player.private])).toEqual([['Alice', true, true], ['Bob', false, false]]);
  });

  it('sorts players who spent as much by name, and lists one who only has a channel', async () => {
    const { fm, cyril, spend, players } = await setup();
    await spend('42', 1000, 'c-cyril');
    await spend('7', 1000, 'c-bob');
    await fm.botEvent('channel-created', { channelId: 'c-dan', channelName: 'fm-dan', author: { id: '11', displayName: 'Dan', avatarUrl: null } });

    expect((await players(cyril)).map((player) => [player.displayName, player.totalKamas, player.seanceCount])).toEqual([['Bob', 1000, 1], ['Cyril', 1000, 1], ['Dan', 0, 1]]);
  });

  it('sums up each player\'s séances, with their state and item', async () => {
    const { fm, cyril, bob, spend, players } = await setup();
    await fm.botEvent('channel-created', { channelId: 'c-bob', channelName: 'fm-c-bob', author: { id: '7', displayName: 'Bob', avatarUrl: null } });
    await spend('7', 5000, 'c-bob');
    await fm.call('PUT', '/fm/seances/c-bob/item', { token: bob, body: { item: { itemId: '2411', itemName: 'Coiffe Bouftou', imageUrl: 'https://api.dofusdb.fr/img/items/16010.png' } } });

    const [first] = await players(cyril);
    expect(first.seances).toEqual([{
      name: 'fm-c-bob', state: 'running', fmItem: { name: 'Coiffe Bouftou', imageUrl: 'https://api.dofusdb.fr/img/items/16010.png' },
      totalKamas: 5000, sessionCount: 1, lastActivityAt: expect.any(String),
    }]);
  });
});
