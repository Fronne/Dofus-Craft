import { afterEach, describe, expect, it, vi } from 'vitest';
import { sha256Hex } from '../../worker/src/fm/http';
import { createFmWorker } from '../support/fm-worker';

// specs/025-rune-purchase-import (US1, research R2-R3): the Discord login, with Discord simulated.
afterEach(() => vi.unstubAllGlobals());

function stubDiscord(member: 'member' | 'not-member' | 'token-error', guilds?: unknown) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith('/oauth2/token')) {
      return member === 'token-error' ? new Response('{}', { status: 400 }) : Response.json({ access_token: 'discord-access' });
    }
    if (url.endsWith('/users/@me/guilds') && guilds !== undefined) return Response.json(guilds);
    if (url.endsWith('/users/@me')) return Response.json({ id: '42', username: 'cyril', global_name: 'Cyril', avatar: 'abc' });
    if (url.endsWith('/users/@me/guilds/guild-1/member')) {
      return member === 'member' ? Response.json({ roles: [] }) : new Response('{"code":10004}', { status: 404 });
    }
    return new Response('not found', { status: 404 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function startLogin(fm: ReturnType<typeof createFmWorker>, query = '') {
  const response = await fm.call('GET', `/fm/auth/login${query}`);
  return new URL(response.headers.get('Location')!);
}

describe('GET /fm/auth/login', () => {
  it('sends the player to Discord with the minimal scopes and a stored state', async () => {
    const fm = createFmWorker();
    const location = await startLogin(fm);

    expect(`${location.origin}${location.pathname}`).toBe('https://discord.com/oauth2/authorize');
    expect(location.searchParams.get('scope')).toBe('identify guilds guilds.members.read');
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

  // specs/075-connexion-discord-site (US1, FR-004): the login is open to any Discord player.
  it('logs in a player who is not a member of the group\'s server, the session saying so', async () => {
    const fm = createFmWorker();
    stubDiscord('not-member');
    const state = (await startLogin(fm)).searchParams.get('state')!;
    const response = await fm.call('GET', `/fm/auth/callback?code=abc&state=${state}`);

    expect(response.headers.get('Location')).toMatch(/^https:\/\/site\.test\/forgemagie#session=[0-9a-f]{64}$/);
    const token = response.headers.get('Location')!.split('#session=')[1];
    expect(fm.query('SELECT discord_user_id, is_member FROM fm_auth_sessions')).toEqual([{ discord_user_id: '42', is_member: 0 }]);
    expect(fm.query('SELECT discord_user_id FROM fm_players')).toEqual([{ discord_user_id: '42' }]);
    expect(await (await fm.call('GET', '/fm/me', { token })).json()).toMatchObject({ discordUserId: '42', isMember: false });
  });

  it('marks the session of a member', async () => {
    const fm = createFmWorker();
    stubDiscord('member');
    const state = (await startLogin(fm)).searchParams.get('state')!;
    const token = (await fm.call('GET', `/fm/auth/callback?code=abc&state=${state}`)).headers.get('Location')!.split('#session=')[1];
    expect(fm.query('SELECT is_member FROM fm_auth_sessions')).toEqual([{ is_member: 1 }]);
    expect(await (await fm.call('GET', '/fm/me', { token })).json()).toMatchObject({ isMember: true });
  });

  it('logs in without a configured server, as a non-member', async () => {
    const fm = createFmWorker();
    delete fm.env.DISCORD_GUILD_ID;
    stubDiscord('member');
    const state = (await startLogin(fm)).searchParams.get('state')!;
    const response = await fm.call('GET', `/fm/auth/callback?code=abc&state=${state}`);
    expect(response.headers.get('Location')).toMatch(/#session=[0-9a-f]{64}$/);
    expect(fm.query('SELECT is_member FROM fm_auth_sessions')).toEqual([{ is_member: 0 }]);
  });

  it('does not take a Discord error on the membership check for « not a member »', async () => {
    const fm = createFmWorker();
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/oauth2/token')) return Response.json({ access_token: 'discord-access' });
      if (url.endsWith('/users/@me')) return Response.json({ id: '42', username: 'cyril' });
      return new Response('boom', { status: 500 });
    }));
    const state = (await startLogin(fm)).searchParams.get('state')!;
    const response = await fm.call('GET', `/fm/auth/callback?code=abc&state=${state}`);
    expect(response.headers.get('Location')).toBe('https://site.test/forgemagie#error=login-failed');
    expect(fm.query('SELECT * FROM fm_auth_sessions')).toEqual([]);
  });

  it('tells a refusal on Discord from a failure', async () => {
    const fm = createFmWorker();
    stubDiscord('member');
    const state = (await startLogin(fm, '?return_path=/hdv')).searchParams.get('state')!;
    const response = await fm.call('GET', `/fm/auth/callback?error=access_denied&state=${encodeURIComponent(state)}`);
    expect(response.headers.get('Location')).toBe('https://site.test/hdv#error=cancelled');
    expect(fm.query('SELECT * FROM fm_auth_sessions')).toEqual([]);
    expect(fm.query('SELECT * FROM fm_oauth_states')).toEqual([]);
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

// specs/045-restore-production-worker (US5): the name of the group's server, and a site run locally.
describe('the group\'s server name', () => {
  const login = async (fm: ReturnType<typeof createFmWorker>) => {
    const state = (await startLogin(fm)).searchParams.get('state')!;
    return (await fm.call('GET', `/fm/auth/callback?code=abc&state=${state}`)).headers.get('Location')!;
  };

  it('is read among the player\'s servers at login, kept once, and given with the profile', async () => {
    const fm = createFmWorker();
    stubDiscord('member', [{ id: 'other', name: 'Ailleurs' }, { id: 'guild-1', name: '  Les Forgemages  ' }]);
    const token = (await login(fm)).split('#session=')[1];
    expect(fm.query('SELECT id, name FROM fm_guild')).toEqual([{ id: 'current', name: 'Les Forgemages' }]);
    expect(await (await fm.call('GET', '/fm/me', { token })).json()).toMatchObject({ guildName: 'Les Forgemages' });

    stubDiscord('member', [{ id: 'guild-1', name: 'Nouveau nom' }]);
    await login(fm);
    expect(fm.query('SELECT id, name FROM fm_guild')).toEqual([{ id: 'current', name: 'Nouveau nom' }]);
  });

  it('never blocks the login when it cannot be read', async () => {
    const fm = createFmWorker();
    for (const guilds of [undefined, 'oops', [{ id: 'other', name: 'Ailleurs' }], [{ id: 'guild-1', name: '   ' }]]) {
      stubDiscord('member', guilds);
      expect(await login(fm)).toMatch(/#session=[0-9a-f]{64}$/);
    }
    expect(fm.query('SELECT * FROM fm_guild')).toEqual([]);
    const token = await fm.login('42');
    expect(await (await fm.call('GET', '/fm/me', { token })).json()).toMatchObject({ guildName: null });
  });
});

describe('a site run on the developer\'s machine', () => {
  const back = async (returnTo: string, member: 'member' | 'not-member' = 'member') => {
    const fm = createFmWorker();
    stubDiscord(member);
    const state = (await startLogin(fm, `?return_to=${encodeURIComponent(returnTo)}`)).searchParams.get('state')!;
    return (await fm.call('GET', `/fm/auth/callback?code=abc&state=${encodeURIComponent(state)}`)).headers.get('Location')!;
  };

  it('is sent back to itself, on localhost or 127.0.0.1, after a login or a refusal', async () => {
    expect(await back('http://localhost:5173/forgemagie?x=1')).toMatch(/^http:\/\/localhost:5173\/forgemagie#session=[0-9a-f]{64}$/);
    expect(await back('http://127.0.0.1:4173')).toMatch(/^http:\/\/127\.0\.0\.1:4173\/forgemagie#session=/);
    expect(await back('http://localhost:5173', 'not-member')).toMatch(/^http:\/\/localhost:5173\/forgemagie#session=[0-9a-f]{64}$/);
  });

  it('ignores any other address: the player goes back to the site', async () => {
    for (const returnTo of ['https://evil.test', 'https://localhost:5173', 'http://localhost.evil.test', 'not a url']) {
      expect(await back(returnTo)).toMatch(/^https:\/\/site\.test\/forgemagie#session=/);
    }
  });
});

// specs/075-connexion-discord-site (FR-003, research R3): back to the page the player came from.
describe('the page the player goes back to', () => {
  const back = async (query: string, site = 'https://site.test') => {
    const fm = createFmWorker();
    stubDiscord('member');
    const state = (await startLogin(fm, query)).searchParams.get('state')!;
    const location = (await fm.call('GET', `/fm/auth/callback?code=abc&state=${encodeURIComponent(state)}`)).headers.get('Location')!;
    expect(location.startsWith(site)).toBe(true);
    return location.slice(site.length);
  };

  it('is the one asked for with return_path', async () => {
    expect(await back('?return_path=/hdv')).toMatch(/^\/hdv#session=[0-9a-f]{64}$/);
    expect(await back('?return_path=/rentabilite?tri=gain')).toMatch(/^\/rentabilite\?tri=gain#session=/);
    expect(await back(`?return_path=/&return_to=${encodeURIComponent('http://localhost:5173')}`, 'http://localhost:5173')).toMatch(/^\/#session=/);
  });

  it('is the Forgemagie when none is asked for', async () => {
    expect(await back('')).toMatch(/^\/forgemagie#session=/);
  });

  it('is never another address', async () => {
    const tooLong = `/${'a'.repeat(200)}`;
    for (const path of ['//evil.test', 'https://evil.test', '/a\\b', '/a:b', '/a#b', 'hdv', tooLong, '/a%0Ab']) {
      const found = await back(`?return_path=${encodeURIComponent(path)}`);
      // « /a%0Ab » stays an ordinary path (the line break is encoded); every other one is refused.
      expect(found).toMatch(path === '/a%0Ab' ? /^\/a%0Ab#session=/ : /^\/forgemagie#session=/);
    }
    expect(await back(`?return_path=${encodeURIComponent('/a\nb')}`)).toMatch(/^\/forgemagie#session=/);
  });

  it('is kept for a failure too', async () => {
    const fm = createFmWorker();
    stubDiscord('token-error');
    const state = (await startLogin(fm, '?return_path=/hdv')).searchParams.get('state')!;
    const response = await fm.call('GET', `/fm/auth/callback?code=abc&state=${encodeURIComponent(state)}`);
    expect(response.headers.get('Location')).toBe('https://site.test/hdv#error=login-failed');
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
