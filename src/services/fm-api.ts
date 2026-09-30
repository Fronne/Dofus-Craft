import type {
  FmChannel, FmChannelRequest, FmItemRecap, FmMe, FmOwnedItem, FmPlayerSpend, FmProfile, FmSession, FmSessionDetail, FmSessionsPage, PriceStatus,
} from '../domain/forgemagie';
import { clearFmSessionToken, readFmSessionToken } from '../persistence/fm-session-token';

// specs/025-rune-purchase-import (contracts/fm-site-api.md): the Forgemagie routes of the Worker. Like
// community-price-api.ts, nothing here throws: every failure resolves to a status the page can show.
const API_URL = import.meta.env.VITE_COMMUNITY_API_URL;

export type FmResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'unauthorized' }
  | { status: 'not-found' }
  | { status: 'error'; code?: string }
  | { status: 'unavailable' };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** Where the « Se connecter avec Discord » button leads: the Worker sends the player on to Discord. */
export function fmLoginUrl(): string {
  return `${API_URL}/fm/auth/login`;
}

async function request<T>(method: string, path: string, isValid: (value: unknown) => value is T, body?: unknown): Promise<FmResult<T>> {
  const token = readFmSessionToken();
  if (!token) return { status: 'unauthorized' };
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { status: 'unavailable' };
  }
  if (response.status === 401) {
    // The session expired or was ended elsewhere: the player logs in again.
    clearFmSessionToken();
    return { status: 'unauthorized' };
  }
  if (response.status === 404) return { status: 'not-found' };
  if (response.status === 204) return isValid(undefined) ? { status: 'ok', data: undefined as T } : { status: 'unavailable' };
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { status: 'unavailable' };
  }
  if (!response.ok) {
    if (response.status >= 400 && response.status < 500) {
      return { status: 'error', code: isRecord(payload) && typeof payload.error === 'string' ? payload.error : undefined };
    }
    return { status: 'unavailable' };
  }
  return isValid(payload) ? { status: 'ok', data: payload } : { status: 'unavailable' };
}

const isNothing = (value: unknown): value is undefined => value === undefined;

function mapOk<T, U>(result: FmResult<T>, map: (data: T) => U): FmResult<U> {
  return result.status === 'ok' ? { status: 'ok', data: map(result.data) } : result;
}

// specs/027: a Worker from before the item recap sends no `fmItem`, `canAttach`, `canDetach` or
// `fmItems`: they read as « not attached », « no action » and « no item ».
// specs/028: nor `owner`, `origin`, `sync` or `canStop` (a Discord session nobody can stop from the site).
const withSessionItem = <T extends FmSession>(session: T): T => ({
  ...session,
  fmItem: session.fmItem ?? null,
  fmItemSource: session.fmItemSource ?? (session.fmItem ? 'session' : null),
  owner: session.owner ?? null,
  origin: session.origin === 'site' ? 'site' : 'discord',
  sync: session.sync ?? null,
  canStop: session.canStop === true,
});
const withDetailActions = (session: FmSessionDetail): FmSessionDetail => ({
  ...withSessionItem(session),
  canAttach: session.canAttach === true,
  canDetach: session.canDetach === true,
});

function isSessionItem(value: unknown): boolean {
  return value === undefined || value === null ||
    (isRecord(value) && (value.private === true || (typeof value.id === 'string' && typeof value.name === 'string' && isPlayer(value.owner))));
}

function isOwnedItem(value: unknown): value is FmOwnedItem {
  return isRecord(value) && typeof value.id === 'string' && typeof value.itemId === 'string' &&
    typeof value.itemName === 'string' && (value.label === null || typeof value.label === 'string') &&
    (value.imageUrl === null || typeof value.imageUrl === 'string') && isPlayer(value.owner) &&
    typeof value.totalKamas === 'number' && typeof value.sessionCount === 'number';
}

function isItemRecap(value: unknown): value is FmItemRecap {
  if (!isOwnedItem(value)) return false;
  const record = value as unknown as Record<string, unknown>;
  return Array.isArray(record.sessions) && isItemSummaries(record.items);
}

function isMe(value: unknown): value is FmMe {
  return isRecord(value) && typeof value.discordUserId === 'string' && typeof value.displayName === 'string' &&
    typeof value.isPrivate === 'boolean' && (value.serverId === null || typeof value.serverId === 'string');
}

function isPlayer(value: unknown): boolean {
  return isRecord(value) && typeof value.private === 'boolean' &&
    (value.displayName === null || typeof value.displayName === 'string');
}

function isSession(value: unknown): boolean {
  return isRecord(value) && typeof value.id === 'string' && typeof value.channelName === 'string' &&
    (value.status === 'open' || value.status === 'closed') && typeof value.openedAt === 'string' &&
    typeof value.totalKamas === 'number' && Array.isArray(value.players) &&
    value.players.every((row) => isRecord(row) && isPlayer(row.player) && typeof row.spentKamas === 'number') &&
    isSessionItem(value.fmItem);
}

function isItemSummaries(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) => isRecord(item) && typeof item.itemName === 'string' &&
    typeof item.quantity === 'number' && typeof item.totalKamas === 'number' && typeof item.averageUnitKamas === 'number');
}

function isSessionsPage(value: unknown): value is FmSessionsPage {
  return isRecord(value) && Array.isArray(value.sessions) && value.sessions.every(isSession) &&
    (value.nextBefore === null || typeof value.nextBefore === 'string');
}

function isSessionDetail(value: unknown): value is FmSessionDetail {
  return isSession(value) && isRecord(value) && isItemSummaries(value.items);
}

function isPlayers(value: unknown): value is { players: FmPlayerSpend[] } {
  return isRecord(value) && Array.isArray(value.players) &&
    value.players.every((player) => isPlayer(player) && isRecord(player) && typeof player.totalKamas === 'number');
}

function isProfile(value: unknown): value is FmProfile {
  return isRecord(value) && isPlayer(value.player) && typeof value.totalKamas === 'number' &&
    typeof value.importedKamas === 'number' && Array.isArray(value.sessions) && isItemSummaries(value.items) &&
    (value.fmItems === undefined || (Array.isArray(value.fmItems) && value.fmItems.every(isOwnedItem)));
}

export type ImportLineRequest = { itemName: string; itemId: string; quantity: number; totalKamas: number };
export type ImportAnswer = { captureId: string; lines: { index: number; unitPriceKamas: number; priceStatus: PriceStatus }[] };

function isImportAnswer(value: unknown): value is ImportAnswer {
  return isRecord(value) && typeof value.captureId === 'string' && Array.isArray(value.lines);
}

export const getFmMe = () => request('GET', '/fm/me', isMe);
export const updateFmMe = (changes: { serverId?: string; isPrivate?: boolean }) => request('PATCH', '/fm/me', isMe, changes);
export const deleteFmMe = () => request('DELETE', '/fm/me', isNothing);
export const logoutFm = () => request('POST', '/fm/auth/logout', isNothing);

export async function getFmSessions(before?: string | null, filter: { mine?: 'open' } = {}) {
  const params = new URLSearchParams();
  if (before) params.set('before', before);
  if (filter.mine) params.set('mine', filter.mine);
  const query = params.size > 0 ? `?${params.toString()}` : '';
  return mapOk(await request('GET', `/fm/sessions${query}`, isSessionsPage), (page) => ({ ...page, sessions: page.sessions.map(withSessionItem) }));
}

const sessionPath = (sessionId: string) => `/fm/sessions/${encodeURIComponent(sessionId)}`;
export const getFmSession = async (sessionId: string) => mapOk(await request('GET', sessionPath(sessionId), isSessionDetail), withDetailActions);
export const getFmPlayers = () => request('GET', '/fm/players', isPlayers);
export const getFmPlayer = async (discordUserId: string) =>
  mapOk(await request('GET', `/fm/players/${encodeURIComponent(discordUserId)}`, isProfile), (profile) => ({ ...profile, fmItems: profile.fmItems ?? [], fmChannels: profile.fmChannels ?? [] }));

// specs/027-fm-item-recap (contracts/fm-items-api.md).
const itemPath = (id: string) => `/fm/items/${encodeURIComponent(id)}`;
export const createFmItem = (item: { itemId: string; itemName: string; imageUrl: string | null; label: string | null }) =>
  request('POST', '/fm/items', isOwnedItem, item);
export const renameFmItem = (id: string, label: string | null) => request('PATCH', itemPath(id), isOwnedItem, { label });
export const deleteFmItem = (id: string) => request('DELETE', itemPath(id), isNothing);
export const getFmItem = (id: string) => request('GET', itemPath(id), isItemRecap);
/** Errors: `not-participant` (403), `already-attached` (409). */
export const attachFmSession = async (sessionId: string, fmItemId: string) =>
  mapOk(await request('PUT', `${sessionPath(sessionId)}/item`, isSessionDetail, { fmItemId }), withDetailActions);
export const detachFmSession = async (sessionId: string) =>
  mapOk(await request('DELETE', `${sessionPath(sessionId)}/item`, isSessionDetail), withDetailActions);

export function importFmCapture(lines: ImportLineRequest[], sharePrices: boolean, sessionId?: string) {
  return request('POST', '/fm/imports', isImportAnswer, { sharePrices, lines, ...(sessionId ? { sessionId } : {}) });
}

// specs/028-site-started-sessions (contracts/fm-site-sessions-api.md).
function isChannel(value: unknown): value is FmChannel {
  return isRecord(value) && typeof value.channelId === 'string' && typeof value.channelName === 'string' &&
    typeof value.status === 'string' && (value.fmItem === null || isRecord(value.fmItem));
}

function isChannels(value: unknown): value is { channels: FmChannel[] } {
  return isRecord(value) && Array.isArray(value.channels) && value.channels.every(isChannel);
}

function isChannelRequest(value: unknown): value is FmChannelRequest {
  return isRecord(value) && typeof value.id === 'string' && (value.status === 'pending' || value.status === 'done' || value.status === 'failed');
}

// specs/029-channel-ownership (contracts/fm-channels-api.md).
/** Errors: `channel-limit` (409). */
export const createFmChannel = (name: string, fmItemId: string | null) =>
  request('POST', '/fm/channels', (value): value is { requestId: string } => isRecord(value) && typeof value.requestId === 'string', { name, fmItemId });
export const getFmChannelRequest = (id: string) => request('GET', `/fm/channel-requests/${encodeURIComponent(id)}`, isChannelRequest);
export const attachFmChannel = (channelId: string, fmItemId: string | null) =>
  request('PUT', `/fm/channels/${encodeURIComponent(channelId)}/item`, isChannel, { fmItemId });

export const getFmChannels = () => request('GET', '/fm/channels', isChannels);
/** Errors: `channel-busy` (409). */
export const startFmSession = async (channelId: string, fmItemId: string | null) =>
  mapOk(await request('POST', '/fm/sessions', isSessionDetail, { channelId, fmItemId }), withDetailActions);
/** Errors: `not-open` (409). */
export const stopFmSession = async (sessionId: string) =>
  mapOk(await request('POST', `${sessionPath(sessionId)}/stop`, isSessionDetail), withDetailActions);
export const resendFmSession = async (sessionId: string) =>
  mapOk(await request('POST', `${sessionPath(sessionId)}/resend`, isSessionDetail), withDetailActions);
