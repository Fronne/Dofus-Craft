import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachFmSession, getFmMe, getFmSessions, startFmSession } from '../../src/services/fm-api';
import { readFmSessionToken, writeFmSessionToken } from '../../src/persistence/fm-session-token';

// specs/025-rune-purchase-import (contracts/fm-site-api.md): the site's client of the /fm/* routes.
const me = { discordUserId: '42', displayName: 'Cyril', avatarUrl: null, serverId: 'mikhal', isPrivate: false, firstLoginAt: null };

beforeEach(() => {
  window.localStorage.clear();
  writeFmSessionToken('abc');
});
afterEach(() => vi.unstubAllGlobals());

describe('fm-api', () => {
  it('sends the session token as a bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(me));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getFmMe()).resolves.toEqual({ status: 'ok', data: me });
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).toMatchObject({ Authorization: 'Bearer abc' });
  });

  it('forgets the token when the Worker answers 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'Unauthorized' }, { status: 401 })));
    await expect(getFmMe()).resolves.toEqual({ status: 'unauthorized' });
    expect(readFmSessionToken()).toBeUndefined();
  });

  it('is unauthorized without calling the Worker when there is no token', async () => {
    window.localStorage.clear();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(getFmMe()).resolves.toEqual({ status: 'unauthorized' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is unavailable on a network error or a malformed answer, never throwing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(getFmSessions()).resolves.toEqual({ status: 'unavailable' });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ sessions: 'nope' })));
    await expect(getFmSessions()).resolves.toEqual({ status: 'unavailable' });
  });

  it('gives the error code of a refused request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'no-server' }, { status: 409 })));
    const { importFmCapture } = await import('../../src/services/fm-api');
    await expect(importFmCapture([], true)).resolves.toEqual({ status: 'error', code: 'no-server' });
  });

  // specs/027-fm-item-recap.
  it('gives the reason a session could not be attached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'already-attached' }, { status: 409 })));
    await expect(attachFmSession('s1', 'i1')).resolves.toEqual({ status: 'error', code: 'already-attached' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'not-participant' }, { status: 403 })));
    await expect(attachFmSession('s1', 'i1')).resolves.toEqual({ status: 'error', code: 'not-participant' });
  });

  it('reads a session from an older Worker, without fmItem, as not attached', async () => {
    const session = { id: 's1', channelName: 'fm', status: 'open', openedAt: '2026-09-30T18:00:00Z', closedAt: null, totalKamas: 0, players: [] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ sessions: [session], nextBefore: null })));
    await expect(getFmSessions()).resolves.toEqual({ status: 'ok', data: {
      sessions: [{ ...session, fmItem: null, fmItemSource: null, owner: null, origin: 'discord', sync: null, canStop: false }], nextBefore: null,
    } });
  });

  // specs/028-site-started-sessions.
  it('gives the reason a session could not be started', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'channel-busy' }, { status: 409 })));
    await expect(startFmSession('c1', null)).resolves.toEqual({ status: 'error', code: 'channel-busy' });
  });
});
