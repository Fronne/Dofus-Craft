import { handleCallback, handleLogin, handleLogout } from './auth';
import { handleBotEvent } from './bot-events';
import { json, requireSession, unauthorized, type FmEnv } from './http';
import { handleImport } from './imports';
import { deleteMe, getMe, patchMe } from './me';
import { listPlayers, playerProfile, sessionDetail, sessionsPage } from './reads';

// specs/025-rune-purchase-import: every /fm/* route, handled before the Worker's COMMUNITY_API_KEY check
// (research R3) — each one has its own authentication: the bot's key, or the site's session token.
export async function handleFm(request: Request, url: URL, env: FmEnv): Promise<Response> {
  const { pathname } = url;
  const method = request.method;

  if (method === 'POST' && pathname === '/fm/bot/events') return handleBotEvent(request, env);
  if (method === 'GET' && pathname === '/fm/auth/login') return handleLogin(url, env);
  if (method === 'GET' && pathname === '/fm/auth/callback') return handleCallback(url, env);
  if (method === 'POST' && pathname === '/fm/auth/logout') return handleLogout(request, env);

  const viewerId = await requireSession(request, env.DB);
  if (!viewerId) return unauthorized();

  if (pathname === '/fm/me') {
    if (method === 'GET') return getMe(env.DB, viewerId);
    if (method === 'PATCH') return patchMe(request, env.DB, viewerId);
    if (method === 'DELETE') return deleteMe(env.DB, viewerId);
  }
  if (method === 'GET' && pathname === '/fm/sessions') {
    return json(await sessionsPage(env.DB, viewerId, url.searchParams.get('before')));
  }
  const sessionMatch = /^\/fm\/sessions\/([^/]+)$/.exec(pathname);
  if (method === 'GET' && sessionMatch) {
    const detail = await sessionDetail(env.DB, viewerId, decodeURIComponent(sessionMatch[1]));
    return detail ? json(detail) : json({ error: 'Not found' }, 404);
  }
  if (method === 'GET' && pathname === '/fm/players') return json(await listPlayers(env.DB, viewerId));
  const playerMatch = /^\/fm\/players\/([^/]+)$/.exec(pathname);
  if (method === 'GET' && playerMatch) {
    const profile = await playerProfile(env.DB, viewerId, decodeURIComponent(playerMatch[1]));
    return profile ? json(profile) : json({ error: 'Not found' }, 404);
  }
  if (method === 'POST' && pathname === '/fm/imports') return handleImport(request, env.DB, viewerId);

  return json({ error: 'Not found' }, 404);
}
