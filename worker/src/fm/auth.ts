import { bearerToken, isRecord, noContent, nowIso, randomHex, redirect, sha256Hex, unauthorized, upsertPlayerStatement, type FmEnv } from './http';

// specs/025-rune-purchase-import (research R2-R3, contracts/fm-site-api.md): Discord login. Only members
// of the group's Discord server get a session (FR-002). The Discord access token is used during the
// callback and never stored; the site's session token is stored hashed.

const DISCORD_API = 'https://discord.com/api';
const DISCORD_AUTHORIZE = 'https://discord.com/oauth2/authorize';
// `guilds` is only read for the name of the group's server (specs/045-restore-production-worker).
const SCOPES = 'identify guilds guilds.members.read';
const STATE_TTL_MS = 10 * 60 * 1000;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const callbackUrl = (url: URL) => `${url.origin}/fm/auth/callback`;
const siteUrl = (env: FmEnv, url: URL) => (env.SITE_URL ?? url.origin).replace(/\/$/, '');
const backToSite = (env: FmEnv, url: URL, fragment: string, localSite?: string) => redirect(`${localSite ?? siteUrl(env, url)}/forgemagie#${fragment}`);

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

export async function handleLogin(url: URL, env: FmEnv): Promise<Response> {
  const localSite = localSiteOrigin(url.searchParams.get('return_to'));
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.DISCORD_GUILD_ID) return backToSite(env, url, 'error=login-failed', localSite);
  // The local site to go back to travels in the state itself, after a dot.
  const state = localSite ? `${randomHex(32)}.${localSite}` : randomHex(32);
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
  const failed = (localSite?: string) => backToSite(env, url, 'error=login-failed', localSite);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (url.searchParams.has('error') || !code || !state || !env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.DISCORD_GUILD_ID) return failed();

  // The state is single-use: removed whether or not it is still valid.
  const stored = await env.DB.prepare('SELECT expires_at FROM fm_oauth_states WHERE state = ?').bind(state).first<{ expires_at: string }>();
  await env.DB.prepare('DELETE FROM fm_oauth_states WHERE state = ?').bind(state).run();
  if (!stored || stored.expires_at <= nowIso()) return failed();
  const localSite = localSiteOrigin(state.includes('.') ? state.slice(state.indexOf('.') + 1) : null);

  let user: DiscordUser;
  let guildName: string | undefined;
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
    if (!tokenResponse.ok) return failed(localSite);
    const { access_token: accessToken } = await tokenResponse.json() as { access_token?: string };
    if (!accessToken) return failed(localSite);

    const userResponse = await discordGet('/users/@me', accessToken);
    if (!userResponse.ok) return failed(localSite);
    user = await userResponse.json() as DiscordUser;
    if (!user.id) return failed(localSite);

    // FR-002: 404 means not a member of the group's server.
    const memberResponse = await discordGet(`/users/@me/guilds/${env.DISCORD_GUILD_ID}/member`, accessToken);
    if (memberResponse.status === 404) return backToSite(env, url, 'error=not-member', localSite);
    if (!memberResponse.ok) return failed(localSite);
    guildName = await readGuildName(accessToken, env.DISCORD_GUILD_ID);
  } catch {
    return failed(localSite);
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
    env.DB.prepare('INSERT INTO fm_auth_sessions (token_hash, discord_user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
      .bind(await sha256Hex(token), user.id, new Date(Date.now() + SESSION_TTL_MS).toISOString(), now),
    ...(guildName ? [env.DB.prepare(
      `INSERT INTO fm_guild (id, name, updated_at) VALUES ('current', ?, ?)
       ON CONFLICT (id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at`,
    ).bind(guildName, now)] : []),
  ]);
  return backToSite(env, url, `session=${token}`, localSite);
}

export async function handleLogout(request: Request, env: FmEnv): Promise<Response> {
  const token = bearerToken(request);
  if (!token) return unauthorized();
  await env.DB.prepare('DELETE FROM fm_auth_sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
  return noContent();
}
