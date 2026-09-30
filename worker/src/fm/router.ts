import { handleCallback, handleLogin, handleLogout } from './auth';
import { handleBotEvent } from './bot-events';
import { json, requireSession, unauthorized, type FmEnv } from './http';
import { handleImport } from './imports';
import { acknowledgeCommand, listCommands } from './bot-commands';
import { listChannels, resendSession, startSession, stopSession } from './site-sessions';
import { attachSession, createItem, deleteItem, detachSession, readItemRecap, renameItem } from './items';
import { deleteMe, getMe, patchMe } from './me';
import { listPlayers, playerProfile, sessionDetail, sessionsPage } from './reads';

// specs/025-rune-purchase-import: every /fm/* route, handled before the Worker's COMMUNITY_API_KEY check
// (research R3) — each one has its own authentication: the bot's key, or the site's session token.
export async function handleFm(request: Request, url: URL, env: FmEnv): Promise<Response> {
  const { pathname } = url;
  const method = request.method;

  if (method === 'POST' && pathname === '/fm/bot/events') return handleBotEvent(request, env);
  // specs/028-site-started-sessions: the bot's queue, behind its own key.
  if (method === 'GET' && pathname === '/fm/bot/commands') return listCommands(request, env);
  const ackMatch = /^\/fm\/bot\/commands\/([^/]+)\/ack$/.exec(pathname);
  if (method === 'POST' && ackMatch) return acknowledgeCommand(request, env, decodeURIComponent(ackMatch[1]));
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
  if (method === 'GET' && pathname === '/fm/channels') return listChannels(env.DB);
  if (method === 'POST' && pathname === '/fm/sessions') return startSession(request, env.DB, viewerId);
  const sessionActionMatch = /^\/fm\/sessions\/([^/]+)\/(stop|resend)$/.exec(pathname);
  if (method === 'POST' && sessionActionMatch) {
    const sessionId = decodeURIComponent(sessionActionMatch[1]);
    return sessionActionMatch[2] === 'stop' ? stopSession(env.DB, viewerId, sessionId) : resendSession(env.DB, viewerId, sessionId);
  }
  if (method === 'GET' && pathname === '/fm/sessions') {
    return json(await sessionsPage(env.DB, viewerId, url.searchParams.get('before'), url.searchParams.get('mine')));
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

  // specs/027-fm-item-recap (contracts/fm-items-api.md).
  if (method === 'POST' && pathname === '/fm/items') return createItem(request, env.DB, viewerId);
  const itemMatch = /^\/fm\/items\/([^/]+)$/.exec(pathname);
  if (itemMatch) {
    const id = decodeURIComponent(itemMatch[1]);
    if (method === 'GET') return readItemRecap(env.DB, viewerId, id);
    if (method === 'PATCH') return renameItem(request, env.DB, viewerId, id);
    if (method === 'DELETE') return deleteItem(env.DB, viewerId, id);
  }
  const sessionItemMatch = /^\/fm\/sessions\/([^/]+)\/item$/.exec(pathname);
  if (sessionItemMatch) {
    const sessionId = decodeURIComponent(sessionItemMatch[1]);
    if (method === 'PUT') return attachSession(request, env.DB, viewerId, sessionId);
    if (method === 'DELETE') return detachSession(env.DB, viewerId, sessionId);
  }

  return json({ error: 'Not found' }, 404);
}
