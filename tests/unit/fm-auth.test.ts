import { afterEach, describe, expect, it, vi } from 'vitest';
import { sha256Hex } from '../../worker/src/fm/http';
import { createFmWorker } from '../support/fm-worker';

// specs/025-rune-purchase-import (US1, research R2-R3): the Discord login, with Discord simulated.
afterEach(() => vi.unstubAllGlobals());

function stubDiscord(member: 'member' | 'not-member' | 'token-error') {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/oauth2/token')) {
      return member === 'token-error' ? new Response('{}', { status: 400 }) : Response.json({ access_token: 'discord-access' });
    }
    if (url.endsWith('/users/@me')) return Response.json({ id: '42', username: 'cyril', global_name: 'Cyril', avatar: 'abc' });
    if (url.endsWith('/users/@me/guilds/guild-1/member')) {
      return member === 'member' ? Response.json({ roles: [] }) : new Response('{"code":10004}', { status: 404 });
    }
    return new Response('not found', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function startLogin(fm: ReturnType<typeof createFmWorker>) {
  const response = await fm.call('GET', '/fm/auth/login');
  return new URL(response.headers.get('Location')!);
}

describe('GET /fm/auth/login', () => {
  it('sends the player to Discord with the minimal scopes and a stored state', async () => {
    const fm = createFmWorker();
    const location = await startLogin(fm);

    expect(`${location.origin}${location.pathname}`).toBe('https://discord.com/oauth2/authorize');
    expect(location.searchParams.get('scope')).toBe('identify guilds.members.read');
    expect(location.searchParams.get('client_id')).toBe('client-id');
    expect(location.searchParams.get('redirect_uri')).toBe('https://api.test/fm/auth/callback');
    expect(fm.query('SELECT state FROM fm_oauth_states')).toEqual([{ state: location.searchParams.get('state') }]);
  });
});

describe('GET /fm/auth/callback', () => {
  it('logs a member in: player created, only the token hash stored, state used up', async () => {
    const fm = createFmWorker();
    stubDiscord('member');
    const state = (await startLogin(fm)).searchParams.get('state')!;
    const response = await fm.call('GET', `/fm/auth/callback?code=abc&state=${state}`);

    const location = response.headers.get('Location')!;
    expect(location).toMatch(/^https:\/\/site\.test\/forgemagie#session=[0-9a-f]{64}$/);
    const token = location.split('#session=')[1];
    expect(fm.query('SELECT token_hash, discord_user_id FROM fm_auth_sessions')).toEqual([{ token_hash: await sha256Hex(token), discord_user_id: '42' }]);
    const [player] = fm.query<{ display_name: string; avatar_url: string; first_login_at: string | null }>('SELECT display_name, avatar_url, first_login_at FROM fm_players');
    expect(player).toMatchObject({ display_name: 'Cyril', avatar_url: 'https://cdn.discordapp.com/avatars/42/abc.png' });
    expect(player.first_login_at).not.toBeNull();
    expect(fm.query('SELECT * FROM fm_oauth_states')).toEqual([]);
    expect(await (await fm.call('GET', '/fm/me', { token })).json()).toMatchObject({ discordUserId: '42' });
  });

  it('refuses a player who is not a member of the group\'s server, and records nothing', async () => {
    const fm = createFmWorker();
    stubDiscord('not-member');
    const state = (await startLogin(fm)).searchParams.get('state')!;
    const response = await fm.call('GET', `/fm/auth/callback?code=abc&state=${state}`);

    expect(response.headers.get('Location')).toBe('https://site.test/forgemagie#error=not-member');
    expect(fm.query('SELECT * FROM fm_players')).toEqual([]);
    expect(fm.query('SELECT * FROM fm_auth_sessions')).toEqual([]);
  });

  it('fails with an unknown or expired state, a Discord error or a refused code', async () => {
    const fm = createFmWorker();
    stubDiscord('member');
    const failed = 'https://site.test/forgemagie#error=login-failed';
    expect((await fm.call('GET', '/fm/auth/callback?code=abc&state=unknown')).headers.get('Location')).toBe(failed);
    expect((await fm.call('GET', '/fm/auth/callback?error=access_denied')).headers.get('Location')).toBe(failed);

    fm.sqlite.prepare("INSERT INTO fm_oauth_states (state, expires_at) VALUES ('old', '2020-01-01T00:00:00.000Z')").run();
    expect((await fm.call('GET', '/fm/auth/callback?code=abc&state=old')).headers.get('Location')).toBe(failed);

    stubDiscord('token-error');
    const state = (await startLogin(fm)).searchParams.get('state')!;
    expect((await fm.call('GET', `/fm/auth/callback?code=abc&state=${state}`)).headers.get('Location')).toBe(failed);
    expect(fm.query('SELECT * FROM fm_players')).toEqual([]);
  });
});

describe('POST /fm/auth/logout', () => {
  it('ends the session', async () => {
    const fm = createFmWorker();
    const token = await fm.login('42');
    expect((await fm.call('POST', '/fm/auth/logout', { token })).status).toBe(204);
    expect((await fm.call('GET', '/fm/me', { token })).status).toBe(401);
  });
});

describe('routing', () => {
  it('answers 404 to an unknown Forgemagie path for a logged-in player', async () => {
    const fm = createFmWorker();
    const token = await fm.login('42');
    expect((await fm.call('GET', '/fm/unknown', { token })).status).toBe(404);
  });

  it('refuses an expired session', async () => {
    const fm = createFmWorker();
    fm.sqlite.prepare("INSERT INTO fm_players (discord_user_id, display_name) VALUES ('42', 'Cyril')").run();
    fm.sqlite.prepare("INSERT INTO fm_auth_sessions (token_hash, discord_user_id, expires_at) VALUES (?, '42', '2020-01-01T00:00:00.000Z')")
      .run(await sha256Hex('old-token'));
    expect((await fm.call('GET', '/fm/me', { token: 'old-token' })).status).toBe(401);
  });
});
