import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  archiveFmSeance, correctFmCapture, createFmSeance, deleteFmMe, fmLoginUrl, getFmChannelRequest, getFmMe, getFmPlayer, getFmPlayers,
  getFmSeance, getFmSeances, importFmCapture, logoutFm, removeFmSeanceItem, renameFmItem, reopenFmSeance, resendFmSession,
  setFmSeanceItem, startFmSession, stopFmSession, updateFmMe,
} from '../../src/services/fm-api';
import { readFmSessionToken, writeFmSessionToken } from '../../src/persistence/fm-session-token';

// specs/025-rune-purchase-import then specs/049-fm-seances (contracts/fm-seances-client.md): the site's
// client of the /fm/* routes.
const me = { discordUserId: '42', displayName: 'Cyril', avatarUrl: null, serverId: 'mikhal', isPrivate: false, firstLoginAt: null, guildName: 'Les Forgemages' };
const player = { discordUserId: '42', displayName: 'Cyril', avatarUrl: null, private: false };
const seance = {
  id: 'c1', name: 'fm-cyril-rtograf', state: 'running', discord: 'active', fmItem: null, totalKamas: 15868, sessionCount: 1, captureCount: 1,
  createdAt: '2026-09-30T18:00:00.000Z', lastActivityAt: '2026-09-30T18:30:00.000Z',
};
const summary = { itemName: 'Rune Do Air', itemId: '11663', quantity: 10, totalKamas: 15868, averageUnitKamas: 1587 };
const line = { id: 'l1', itemName: 'Rune Do Air', quantity: 10, totalKamas: 15868, unitPriceKamas: 1587, originalQuantity: 10, originalTotalKamas: 15868, corrected: false, priceStatus: 'recorded' };
const detail = {
  ...seance, quantity: 10, items: [summary], request: null, canResume: false, canArchive: true, canReopen: false,
  sessions: [{
    id: 's1', status: 'open', openedAt: '2026-09-30T18:00:00.000Z', closedAt: null, totalKamas: 15868, sync: null, canStop: true,
    captures: [{ id: 'cap1', createdAt: '2026-09-30T18:10:00.000Z', origin: 'bot', spentKamas: 15868, items: [summary], corrected: false, lines: [line], ignored: [] }],
  }],
};
const ownedItem = { id: 'i1', itemId: '8237', itemName: 'Anneau Rtograf', imageUrl: null, label: 'Rtograf PA', owner: player, totalKamas: 0, sessionCount: 0 };

const without = <T extends object>(value: T, ...keys: (keyof T)[]) =>
  Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key as keyof T)));

function stubFetch(answer: () => Response) {
  const fetchMock = vi.fn().mockImplementation(async () => answer());
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
function lastCall(fetchMock: ReturnType<typeof vi.fn>) {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return { path: new URL(url, 'https://api.test').pathname, method: init.method, body: init.body === undefined ? undefined : JSON.parse(init.body as string) as unknown };
}

beforeEach(() => {
  window.localStorage.clear();
  writeFmSessionToken('abc');
});
afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('fm-api — transport', () => {
  it('sends the session token as a bearer token', async () => {
    const fetchMock = stubFetch(() => Response.json(me));
    await expect(getFmMe()).resolves.toEqual({ status: 'ok', data: me });
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toMatchObject({ Authorization: 'Bearer abc' });
  });

  it('forgets the token when the Worker answers 401', async () => {
    stubFetch(() => Response.json({ error: 'Unauthorized' }, { status: 401 }));
    await expect(getFmSeances()).resolves.toEqual({ status: 'unauthorized' });
    expect(readFmSessionToken()).toBeUndefined();
  });

  it('is unauthorized without calling the Worker when there is no token', async () => {
    window.localStorage.clear();
    const fetchMock = stubFetch(() => Response.json(me));
    await expect(getFmMe()).resolves.toEqual({ status: 'unauthorized' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is unavailable on a network error, a server error or a malformed answer, never throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(getFmSeances()).resolves.toEqual({ status: 'unavailable' });

    stubFetch(() => Response.json({ error: 'boom' }, { status: 500 }));
    await expect(getFmSeances()).resolves.toEqual({ status: 'unavailable' });

    stubFetch(() => Response.json({ seances: 'nope' }));
    await expect(getFmSeances()).resolves.toEqual({ status: 'unavailable' });

    stubFetch(() => new Response('not json', { status: 200 }));
    await expect(getFmSeance('c1')).resolves.toEqual({ status: 'unavailable' });

    stubFetch(() => Response.json({ ...detail, sessions: [{ id: 's1' }] }));
    await expect(getFmSeance('c1')).resolves.toEqual({ status: 'unavailable' });
  });

  it('tells a missing séance from a refused request, with its code', async () => {
    stubFetch(() => Response.json({ error: 'Not found' }, { status: 404 }));
    await expect(getFmSeance('nope')).resolves.toEqual({ status: 'not-found' });

    stubFetch(() => Response.json({ error: 'channel-limit' }, { status: 409 }));
    await expect(reopenFmSeance('c1')).resolves.toEqual({ status: 'error', code: 'channel-limit' });

    stubFetch(() => Response.json({ error: 'session-not-open' }, { status: 409 }));
    await expect(importFmCapture([], true, 's1')).resolves.toEqual({ status: 'error', code: 'session-not-open' });
  });
});

describe('fm-api — profile', () => {
  it('reads, updates, logs out and deletes the profile', async () => {
    const fetchMock = stubFetch(() => Response.json(me));
    await expect(updateFmMe({ serverId: 'mikhal', isPrivate: true })).resolves.toEqual({ status: 'ok', data: me });
    expect(lastCall(fetchMock)).toEqual({ path: '/fm/me', method: 'PATCH', body: { serverId: 'mikhal', isPrivate: true } });

    const empty = stubFetch(() => new Response(null, { status: 204 }));
    await expect(logoutFm()).resolves.toEqual({ status: 'ok', data: undefined });
    expect(lastCall(empty)).toEqual({ path: '/fm/auth/logout', method: 'POST', body: undefined });
    await expect(deleteFmMe()).resolves.toEqual({ status: 'ok', data: undefined });
    expect(lastCall(empty)).toEqual({ path: '/fm/me', method: 'DELETE', body: undefined });
  });

  it('accepts a profile from an API that does not send the group\'s name', async () => {
    const older = without(me, 'guildName');
    stubFetch(() => Response.json(older));
    await expect(getFmMe()).resolves.toEqual({ status: 'ok', data: older });
  });

  it('reads a player\'s profile, defaulting what an older API does not send', async () => {
    const fetchMock = stubFetch(() => Response.json({
      player, totalKamas: 1000, importedKamas: 0, items: [],
      sessions: [{ sessionId: 's1', channelName: 'fm-cape', openedAt: '2026-09-30T18:00:00.000Z', spentKamas: 1000 }],
    }));
    const result = await getFmPlayer('4 2');
    expect(lastCall(fetchMock)).toMatchObject({ path: '/fm/players/4%202', method: 'GET' });
    expect(result).toMatchObject({ status: 'ok', data: { fmItems: [], sessions: [{ sessionId: 's1', canOpen: false }] } });
  });

  it('lists the players of the group, without séances from an older API', async () => {
    const groupPlayer = { displayName: 'Cyril', avatarUrl: null, isMe: true, private: false, totalKamas: 1000, seanceCount: 1, lastActivityAt: null };
    const fetchMock = stubFetch(() => Response.json({ players: [groupPlayer] }));
    await expect(getFmPlayers()).resolves.toEqual({ status: 'ok', data: [{ ...groupPlayer, seances: [] }] });
    expect(lastCall(fetchMock)).toEqual({ path: '/fm/players', method: 'GET', body: undefined });

    stubFetch(() => Response.json({ players: [{ ...groupPlayer, seances: [{ name: 'fm-x', state: 'weird' }] }] }));
    await expect(getFmPlayers()).resolves.toEqual({ status: 'unavailable' });
  });
});

describe('fm-api — séances de FM', () => {
  it('lists the séances', async () => {
    const fetchMock = stubFetch(() => Response.json({ seances: [seance] }));
    await expect(getFmSeances()).resolves.toEqual({ status: 'ok', data: [seance] });
    expect(lastCall(fetchMock)).toEqual({ path: '/fm/seances', method: 'GET', body: undefined });
  });

  it('reads a séance, defaulting what a capture from an older API lacks', async () => {
    const olderCapture = without(detail.sessions[0].captures[0], 'corrected', 'lines', 'ignored');
    const fetchMock = stubFetch(() => Response.json({ ...detail, sessions: [{ ...detail.sessions[0], captures: [olderCapture] }] }));
    const result = await getFmSeance('c 1');
    expect(lastCall(fetchMock)).toEqual({ path: '/fm/seances/c%201', method: 'GET', body: undefined });
    expect(result.status === 'ok' && result.data.sessions[0].captures[0]).toMatchObject({ id: 'cap1', corrected: false, lines: [], ignored: [] });
  });

  it.each([
    ['archives', () => archiveFmSeance('c1'), { path: '/fm/seances/c1/archive', method: 'POST', body: undefined }],
    ['reopens', () => reopenFmSeance('c1'), { path: '/fm/seances/c1/reopen', method: 'POST', body: undefined }],
    ['sets the item of, from one of the player\'s', () => setFmSeanceItem('c1', { fmItemId: 'i1' }), { path: '/fm/seances/c1/item', method: 'PUT', body: { fmItemId: 'i1' } }],
    ['sets the item of, from the catalogue', () => setFmSeanceItem('c1', { item: { itemId: '8237', itemName: 'Anneau Rtograf', imageUrl: null } }),
      { path: '/fm/seances/c1/item', method: 'PUT', body: { item: { itemId: '8237', itemName: 'Anneau Rtograf', imageUrl: null } } }],
    ['removes the item of', () => removeFmSeanceItem('c1'), { path: '/fm/seances/c1/item', method: 'DELETE', body: undefined }],
    ['corrects a capture of', () => correctFmCapture('cap1', [{ id: 'l1', quantity: 1, totalKamas: 15868 }]),
      { path: '/fm/captures/cap1/lines', method: 'PUT', body: { lines: [{ id: 'l1', quantity: 1, totalKamas: 15868 }] } }],
  ])('%s a séance and answers with it', async (_name, call, expected) => {
    const fetchMock = stubFetch(() => Response.json(detail));
    await expect(call()).resolves.toEqual({ status: 'ok', data: detail });
    expect(lastCall(fetchMock)).toEqual(expected);
  });

  it('renames an item in FM, or gives it back its equipment\'s name', async () => {
    const fetchMock = stubFetch(() => Response.json(ownedItem));
    await expect(renameFmItem('i1', 'Rtograf PA')).resolves.toEqual({ status: 'ok', data: ownedItem });
    expect(lastCall(fetchMock)).toEqual({ path: '/fm/items/i1', method: 'PATCH', body: { label: 'Rtograf PA' } });
    await renameFmItem('i1', null);
    expect(lastCall(fetchMock).body).toEqual({ label: null });
  });

  it('imports a capture into a session', async () => {
    const answer = { captureId: 'cap2', lines: [{ index: 0, unitPriceKamas: 1587, priceStatus: 'recorded' }] };
    const fetchMock = stubFetch(() => Response.json(answer));
    const lines = [{ itemName: 'Rune Do Air', itemId: '11663', quantity: 10, totalKamas: 15868 }];
    await expect(importFmCapture(lines, true, 's1')).resolves.toEqual({ status: 'ok', data: answer });
    expect(lastCall(fetchMock)).toEqual({ path: '/fm/imports', method: 'POST', body: { sharePrices: true, lines, sessionId: 's1' } });
  });
});

describe('fm-api — creating a séance, and its sessions', () => {
  it('asks for a new séance, with or without an item', async () => {
    const fetchMock = stubFetch(() => Response.json({ requestId: 'r1' }));
    await expect(createFmSeance('mon rtograf')).resolves.toEqual({ status: 'ok', data: { requestId: 'r1' } });
    expect(lastCall(fetchMock)).toEqual({ path: '/fm/channels', method: 'POST', body: { name: 'mon rtograf', fmItemId: null } });

    await createFmSeance('mon rtograf', { fmItemId: 'i1' });
    expect(lastCall(fetchMock).body).toEqual({ name: 'mon rtograf', fmItemId: 'i1' });

    await createFmSeance('mon rtograf', { item: { itemId: '8237', itemName: 'Anneau Rtograf', imageUrl: null } });
    expect(lastCall(fetchMock).body).toEqual({ name: 'mon rtograf', item: { itemId: '8237', itemName: 'Anneau Rtograf', imageUrl: null } });
  });

  it('follows the request of a new séance', async () => {
    const request = { id: 'r1', status: 'done', error: null, channelId: 'c9', sessionId: 's1' };
    const fetchMock = stubFetch(() => Response.json(request));
    await expect(getFmChannelRequest('r1')).resolves.toEqual({ status: 'ok', data: request });
    expect(lastCall(fetchMock)).toEqual({ path: '/fm/channel-requests/r1', method: 'GET', body: undefined });

    stubFetch(() => Response.json({ id: 'r1', status: 'unknown' }));
    await expect(getFmChannelRequest('r1')).resolves.toEqual({ status: 'unavailable' });
  });

  it('starts, stops and resends a session', async () => {
    const fetchMock = stubFetch(() => Response.json({ id: 's2' }));
    await expect(startFmSession('c1')).resolves.toEqual({ status: 'ok', data: { id: 's2' } });
    expect(lastCall(fetchMock)).toEqual({ path: '/fm/sessions', method: 'POST', body: { channelId: 'c1' } });
    await stopFmSession('s2');
    expect(lastCall(fetchMock)).toEqual({ path: '/fm/sessions/s2/stop', method: 'POST', body: undefined });
    await resendFmSession('s2');
    expect(lastCall(fetchMock)).toEqual({ path: '/fm/sessions/s2/resend', method: 'POST', body: undefined });

    stubFetch(() => Response.json({ error: 'channel-busy' }, { status: 409 }));
    await expect(startFmSession('c1')).resolves.toEqual({ status: 'error', code: 'channel-busy' });
  });
});

describe('fmLoginUrl', () => {
  it('asks a site running on this machine to be sent back here', () => {
    // The tests run on localhost.
    expect(window.location.hostname).toBe('localhost');
    expect(fmLoginUrl()).toMatch(new RegExp(`/fm/auth/login\\?return_to=${encodeURIComponent(window.location.origin)}$`));
  });

  it('asks nothing elsewhere', () => {
    vi.stubGlobal('location', { hostname: 'dofus-craft.handy-apps.workers.dev', origin: 'https://dofus-craft.handy-apps.workers.dev' });
    expect(fmLoginUrl()).toMatch(/\/fm\/auth\/login$/);
  });
});
