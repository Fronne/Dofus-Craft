import { bearerToken, noContent, nowIso, randomHex, redirect, sha256Hex, unauthorized, upsertPlayerStatement, type FmEnv } from './http';

// specs/025-rune-purchase-import (research R2-R3, contracts/fm-site-api.md): Discord login. Only members
// of the group's Discord server get a session (FR-002). The Discord access token is used during the
// callback and never stored; the site's session token is stored hashed.

const DISCORD_API = 'https://discord.com/api';
const DISCORD_AUTHORIZE = 'https://discord.com/oauth2/authorize';
const SCOPES = 'identify guilds.members.read';
const STATE_TTL_MS = 10 * 60 * 1000;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const callbackUrl = (url: URL) => `${url.origin}/fm/auth/callback`;
const siteUrl = (env: FmEnv, url: URL) => (env.SITE_URL ?? url.origin).replace(/\/$/, '');
const backToSite = (env: FmEnv, url: URL, fragment: string) => redirect(`${siteUrl(env, url)}/forgemagie#${fragment}`);

export async function handleLogin(url: URL, env: FmEnv): Promise<Response> {
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.DISCORD_GUILD_ID) return backToSite(env, url, 'error=login-failed');
  const state = randomHex(32);
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

export async function handleCallback(url: URL, env: FmEnv): Promise<Response> {
  const failed = () => backToSite(env, url, 'error=login-failed');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (url.searchParams.has('error') || !code || !state || !env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.DISCORD_GUILD_ID) return failed();

  // The state is single-use: removed whether or not it is still valid.
  const stored = await env.DB.prepare('SELECT expires_at FROM fm_oauth_states WHERE state = ?').bind(state).first<{ expires_at: string }>();
  await env.DB.prepare('DELETE FROM fm_oauth_states WHERE state = ?').bind(state).run();
  if (!stored || stored.expires_at <= nowIso()) return failed();

  let user: DiscordUser;
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

    // FR-002: 404 means not a member of the group's server.
    const memberResponse = await discordGet(`/users/@me/guilds/${env.DISCORD_GUILD_ID}/member`, accessToken);
    if (memberResponse.status === 404) return backToSite(env, url, 'error=not-member');
    if (!memberResponse.ok) return failed();
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
    env.DB.prepare('INSERT INTO fm_auth_sessions (token_hash, discord_user_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
      .bind(await sha256Hex(token), user.id, new Date(Date.now() + SESSION_TTL_MS).toISOString(), now),
  ]);
  return backToSite(env, url, `session=${token}`);
}

export async function handleLogout(request: Request, env: FmEnv): Promise<Response> {
  const token = bearerToken(request);
  if (!token) return unauthorized();
  await env.DB.prepare('DELETE FROM fm_auth_sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
  return noContent();
}
