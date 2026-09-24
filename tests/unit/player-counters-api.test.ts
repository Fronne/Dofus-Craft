import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPlayerCounters } from '../../src/services/player-counters-api';

const counter = {
  id: 'nicomoux',
  player: 'Nicomoux',
  breedId: 12,
  sex: 'm',
  count: 157,
  atLeast: false,
  unitOne: 'tentative de FM',
  unitMany: 'tentatives de FM',
  target: { itemId: 14094, name: 'Amulette du Strigide', icon: 'https://api.dofusdb.fr/img/items/1235.png' },
  createdAt: '2026-09-24T00:00:01.000Z',
  updatedAt: '2026-09-24T00:00:01.000Z',
};

describe('player counters service (specs/014-admin-counters)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reads the shared list', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify([counter]), { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    await expect(getPlayerCounters()).resolves.toEqual({ status: 'ok', counters: [counter] });
    expect(String(fetchSpy.mock.calls[0][0])).toMatch(/\/player-counters$/);
  });

  it('is unavailable, never throwing, on a network error, an error status or a malformed list', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(getPlayerCounters()).resolves.toEqual({ status: 'unavailable' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 500 })));
    await expect(getPlayerCounters()).resolves.toEqual({ status: 'unavailable' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([{ ...counter, count: -2 }]), { status: 200 })));
    await expect(getPlayerCounters()).resolves.toEqual({ status: 'unavailable' });
  });
});
