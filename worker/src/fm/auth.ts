import { bearerToken, isRecord, noContent, nowIso, randomHex, redirect, sha256Hex, unauthorized, upsertPlayerStatement, type FmEnv } from './http';

// specs/025-rune-purchase-import (research R2-R3, contracts/fm-site-api.md): Discord login. The Discord access
// token is used during the callback and never stored; the site's session token is stored hashed.
// specs/075-connexion-discord-site: the login serves the whole site. Any Discord player gets a session; whether
// they were a member of the group's Discord server is kept on it (`is_member`) and checked by the Forgemagie routes.

const DISCORD_API = 'https://discord.com/api';
const DISCORD_AUTHORIZE = 'https://discord.com/oauth2/authorize';
// `guilds` is only read for the name of the group's server (specs/045-restore-production-worker).
const SCOPES = 'identify guilds guilds.members.read';
const STATE_TTL_MS = 10 * 60 * 1000;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// Where a login without `return_path` leads: the Forgemagie, as before the login served the whole site.
const DEFAULT_RETURN_PATH = '/forgemagie';
const MAX_RETURN_PATH_LENGTH = 200;

type ReturnTarget = { localSite?: string; path?: string };

const callbackUrl = (url: URL) => `${url.origin}/fm/auth/callback`;
const siteUrl = (env: FmEnv, url: URL) => (env.SITE_URL ?? url.origin).replace(/\/$/, '');
const backToSite = (env: FmEnv, url: URL, fragment: string, target: ReturnTarget = {}) =>
  redirect(`${target.localSite ?? siteUrl(env, url)}${target.path ?? DEFAULT_RETURN_PATH}#${fragment}`);

// A site run on the developer's own machine may ask to be sent back to itself (`return_to`); any other
// address is ignored and the player goes back to SITE_URL.
function localSiteOrigin(value: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const site = new URL(value);
    return site.protocol === 'http:' && (site.hostname === 'localhost' || site.hostname === '127.0.0.1') ? site.origin : undefined;
  } catch {
    return undefined;
  }
}

// The page of the site to go back to (`return_path`): a path of the site itself, never another address.
export function safeReturnPath(value: string | null): string | undefined {
  if (!value || value.length > MAX_RETURN_PATH_LENGTH) return undefined;
  // The control characters are what the pattern is there to refuse.
  // eslint-disable-next-line no-control-regex
  if (!value.startsWith('/') || value.startsWith('//') || /[\\:#\u0000-\u001f\u007f]/.test(value)) return undefined;
  return value;
}

// The place to go back to travels in the state itself, after a dot (the random part has none), URL-encoded.
function stateWithTarget(random: string, target: ReturnTarget): string {
  return target.localSite || target.path ? `${random}.${encodeURIComponent(JSON.stringify(target))}` : random;
}

function targetOfState(state: string): ReturnTarget {
  const dot = state.indexOf('.');
  if (dot < 0) return {};
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(state.slice(dot + 1)));
    if (!isRecord(parsed)) return {};
    return {
      localSite: localSiteOrigin(typeof parsed.localSite === 'string' ? parsed.localSite : null),
      path: safeReturnPath(typeof parsed.path === 'string' ? parsed.path : null),
    };
  } catch {
    return {};
  }
}

export async function handleLogin(url: URL, env: FmEnv): Promise<Response> {
  const target: ReturnTarget = {
    localSite: localSiteOrigin(url.searchParams.get('return_to')),
    path: safeReturnPath(url.searchParams.get('return_path')),
  };
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) return backToSite(env, url, 'error=login-failed', target);
  const state = stateWithTarget(randomHex(32), target);
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM fm_oauth_states WHERE expires_at < ?').bind(new Date(now).toISOString()),
    env.DB.prepare('INSERT INTO fm_oauth_states (state, expires_at) VALUES (?, ?)').bind(state, new Date(now + STATE_TTL_MS).toISOString()),
  ]);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.DISCORD_CLIENT_ID,
    scope: SCOPES,
    state,
    redirect_uri: callbackUrl(url),
  });
  return redirect(`${DISCORD_AUTHORIZE}?${params.toString()}`);
}

type DiscordUser = { id: string; username: string; global_name?: string | null; avatar?: string | null };

async function discordGet(path: string, accessToken: string): Promise<Response> {
  return fetch(`${DISCORD_API}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
}

const MAX_GUILD_NAME_LENGTH = 100;

// The name of the group's server, among the player's own. A failure never blocks the login.
async function readGuildName(accessToken: string, guildId: string): Promise<string | undefined> {
  try {
    const response = await discordGet('/users/@me/guilds', accessToken);
    if (!response.ok) return undefined;
    const guilds: unknown = await response.json();
    const guild = Array.isArray(guilds)
      ? guilds.find((entry): entry is { id: string; name: string } => isRecord(entry) && entry.id === guildId && typeof entry.name === 'string')
      : undefined;
    return guild?.name.trim().slice(0, MAX_GUILD_NAME_LENGTH) || undefined;
  } catch {
    return undefined;
  }
}

export async function handleCallback(url: URL, env: FmEnv): Promise<Response> {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!state) return backToSite(env, url, 'error=login-failed');

  // The state is single-use: removed whether or not it is still valid.
  const stored = await env.DB.prepare('SELECT expires_at FROM fm_oauth_states WHERE state = ?').bind(state).first<{ expires_at: string }>();
  await env.DB.prepare('DELETE FROM fm_oauth_states WHERE state = ?').bind(state).run();
  if (!stored || stored.expires_at <= nowIso()) return backToSite(env, url, 'error=login-failed');
  const target = targetOfState(state);
  const failed = () => backToSite(env, url, 'error=login-failed', target);
  // The player refused the access on Discord: nothing went wrong, they are simply not logged in.
  if (url.searchParams.get('error') === 'access_denied') return backToSite(env, url, 'error=cancelled', target);
  if (url.searchParams.has('error') || !code || !env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) return failed();

  let user: DiscordUser;
  let guildName: string | undefined;
  let isMember = false;
  try {
    const tokenResponse = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: callbackUrl(url),
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
      }),
    });
    if (!tokenResponse.ok) return failed();
    const { access_token: accessToken } = await tokenResponse.json() as { access_token?: string };
    if (!accessToken) return failed();

    const userResponse = await discordGet('/users/@me', accessToken);
    if (!userResponse.ok) return failed();
    user = await userResponse.json() as DiscordUser;
    if (!user.id) return failed();

    // 404 means not a member of the group's server: the player is logged in all the same, and the routes of the
    // group's data say no. Any other failure is not taken for « not a member ».
    if (env.DISCORD_GUILD_ID) {
      const memberResponse = await discordGet(`/users/@me/guilds/${env.DISCORD_GUILD_ID}/member`, accessToken);
      if (memberResponse.ok) {
        isMember = true;
        guildName = await readGuildName(accessToken, env.DISCORD_GUILD_ID);
      } else if (memberResponse.status !== 404) {
        return failed();
      }
    }
  } catch {
    return failed();
  }

  const now = nowIso();
  const token = randomHex(32);
  await env.DB.batch([
    upsertPlayerStatement(env.DB, {
      discordUserId: user.id,
      displayName: user.global_name || user.username,
      avatarUrl: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null,
    }, now),
    env.DB.prepare('UPDATE fm_players SET first_login_at = COALESCE(first_login_at, ?) WHERE discord_user_id = ?').bind(now, user.id),
    env.DB.prepare('DELETE FROM fm_auth_sessions WHERE expires_at < ?').bind(now),
    env.DB.prepare('INSERT INTO fm_auth_sessions (token_hash, discord_user_id, expires_at, created_at, is_member) VALUES (?, ?, ?, ?, ?)')
      .bind(await sha256Hex(token), user.id, new Date(Date.now() + SESSION_TTL_MS).toISOString(), now, isMember ? 1 : 0),
    ...(guildName ? [env.DB.prepare(
      `INSERT INTO fm_guild (id, name, updated_at) VALUES ('current', ?, ?)
       ON CONFLICT (id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at`,
    ).bind(guildName, now)] : []),
  ]);
  return backToSite(env, url, `session=${token}`, target);
}

export async function handleLogout(request: Request, env: FmEnv): Promise<Response> {
  const token = bearerToken(request);
  if (!token) return unauthorized();
  await env.DB.prepare('DELETE FROM fm_auth_sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
  return noContent();
}
