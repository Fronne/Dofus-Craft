import type {
  FmAttachTarget, FmChannelRequest, FmGroupPlayer, FmMe, FmOwnedItem, FmProfile, FmSeance, FmSeanceDetail, PriceStatus,
} from '../domain/forgemagie';
import { clearFmSessionToken, readFmSessionToken } from '../persistence/fm-session-token';

// specs/025-rune-purchase-import (contracts/fm-site-api.md): the Forgemagie routes of the Worker. Like
// community-price-api.ts, nothing here throws: every failure resolves to a status the page can show.
// specs/049-fm-seances (contracts/fm-seances-client.md): the page is about séances de FM — a player's
// private channels, their sessions and captures — and reads them from /fm/seances.
const API_URL = import.meta.env.VITE_COMMUNITY_API_URL;

export type FmResult<T> =
  | { status: 'ok'; data: T }
  | { status: 'unauthorized' }
  | { status: 'not-found' }
  | { status: 'error'; code?: string }
  | { status: 'unavailable' };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/**
 * Where the « Se connecter avec Discord » button leads: the Worker sends the player on to Discord. A
 * site running on this machine asks to be sent back here rather than to the site in production.
 */
export function fmLoginUrl(): string {
  const { hostname, origin } = window.location;
  const local = hostname === 'localhost' || hostname === '127.0.0.1';
  return `${API_URL}/fm/auth/login${local ? `?return_to=${encodeURIComponent(origin)}` : ''}`;
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

function isMe(value: unknown): value is FmMe {
  return isRecord(value) && typeof value.discordUserId === 'string' && typeof value.displayName === 'string' &&
    typeof value.isPrivate === 'boolean' && (value.serverId === null || typeof value.serverId === 'string') &&
    (value.guildName === undefined || value.guildName === null || typeof value.guildName === 'string');
}

function isPlayer(value: unknown): boolean {
  return isRecord(value) && typeof value.private === 'boolean' &&
    (value.displayName === null || typeof value.displayName === 'string');
}

function isItemSummaries(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) => isRecord(item) && typeof item.itemName === 'string' &&
    typeof item.quantity === 'number' && typeof item.totalKamas === 'number' && typeof item.averageUnitKamas === 'number');
}

function isOwnedItem(value: unknown): value is FmOwnedItem {
  return isRecord(value) && typeof value.id === 'string' && typeof value.itemId === 'string' &&
    typeof value.itemName === 'string' && (value.label === null || typeof value.label === 'string') &&
    (value.imageUrl === null || typeof value.imageUrl === 'string') && isPlayer(value.owner) &&
    typeof value.totalKamas === 'number' && typeof value.sessionCount === 'number';
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

// --- Players ---

const SEANCE_STATES: unknown[] = ['running', 'paused', 'archived'];

function isGroupSeance(value: unknown): boolean {
  return isRecord(value) && typeof value.name === 'string' && SEANCE_STATES.includes(value.state) &&
    (value.fmItem === null || (isRecord(value.fmItem) && typeof value.fmItem.name === 'string' &&
      (value.fmItem.imageUrl === null || typeof value.fmItem.imageUrl === 'string'))) &&
    typeof value.totalKamas === 'number' && typeof value.sessionCount === 'number' && typeof value.lastActivityAt === 'string';
}

function isGroupPlayer(value: unknown): boolean {
  return isRecord(value) && typeof value.displayName === 'string' &&
    (value.avatarUrl === null || typeof value.avatarUrl === 'string') && typeof value.isMe === 'boolean' &&
    typeof value.private === 'boolean' && typeof value.totalKamas === 'number' && typeof value.seanceCount === 'number' &&
    (value.lastActivityAt === null || typeof value.lastActivityAt === 'string') &&
    (value.seances === undefined || (Array.isArray(value.seances) && value.seances.every(isGroupSeance)));
}

/** The players of the group with a public profile (and the viewer), and what forgemagie cost them. */
export const getFmPlayers = async () => mapOk(
  await request('GET', '/fm/players', (value): value is { players: FmGroupPlayer[] } =>
    isRecord(value) && Array.isArray(value.players) && value.players.every(isGroupPlayer)),
  // An API from before the players' séances sends none.
  ({ players }) => players.map((player) => ({ ...player, seances: player.seances ?? [] })),
);

export const getFmPlayer = async (discordUserId: string) =>
  mapOk(await request('GET', `/fm/players/${encodeURIComponent(discordUserId)}`, isProfile), (profile) => ({
    ...profile,
    // specs/030: a session without `canOpen` (an older API) is not offered as a link.
    sessions: profile.sessions.map((session) => ({ ...session, canOpen: session.canOpen === true })),
    fmItems: profile.fmItems ?? [],
  }));

// --- Séances de FM ---

function isSeanceItem(value: unknown): boolean {
  return value === null || (isRecord(value) && typeof value.id === 'string' && typeof value.name === 'string' &&
    typeof value.itemName === 'string' && (value.label === null || typeof value.label === 'string') &&
    (value.imageUrl === null || typeof value.imageUrl === 'string'));
}

function isSeance(value: unknown): value is FmSeance {
  return isRecord(value) && typeof value.id === 'string' && typeof value.name === 'string' &&
    SEANCE_STATES.includes(value.state) && typeof value.discord === 'string' && isSeanceItem(value.fmItem) &&
    typeof value.totalKamas === 'number' && typeof value.sessionCount === 'number' && typeof value.captureCount === 'number' &&
    typeof value.createdAt === 'string' && typeof value.lastActivityAt === 'string';
}

function isSeanceSession(value: unknown): boolean {
  return isRecord(value) && typeof value.id === 'string' && (value.status === 'open' || value.status === 'closed') &&
    typeof value.openedAt === 'string' && typeof value.totalKamas === 'number' && typeof value.canStop === 'boolean' &&
    Array.isArray(value.captures) && value.captures.every((capture) => isRecord(capture) && typeof capture.id === 'string' &&
      typeof capture.createdAt === 'string' && (capture.origin === 'bot' || capture.origin === 'capture') &&
      typeof capture.spentKamas === 'number' && isItemSummaries(capture.items));
}

function isSeanceDetail(value: unknown): value is FmSeanceDetail {
  if (!isRecord(value) || !isSeance(value)) return false;
  const detail = value as unknown as Record<string, unknown>;
  return typeof detail.quantity === 'number' && isItemSummaries(detail.items) &&
    Array.isArray(detail.sessions) && detail.sessions.every(isSeanceSession) &&
    (detail.request === null || isRecord(detail.request)) &&
    typeof detail.canResume === 'boolean' && typeof detail.canArchive === 'boolean' && typeof detail.canReopen === 'boolean';
}

// An API from before the corrections sends captures without `corrected`, `lines` or `ignored`.
const withCaptureDefaults = (seance: FmSeanceDetail): FmSeanceDetail => ({
  ...seance,
  sessions: seance.sessions.map((session) => ({
    ...session,
    captures: session.captures.map((capture) => ({
      ...capture,
      corrected: capture.corrected === true,
      lines: capture.lines ?? [],
      ignored: capture.ignored ?? [],
    })),
  })),
});

const seancePath = (seanceId: string) => `/fm/seances/${encodeURIComponent(seanceId)}`;
const seanceRequest = async (method: string, path: string, body?: unknown) =>
  mapOk(await request(method, path, isSeanceDetail, body), withCaptureDefaults);

export const getFmSeances = async () => mapOk(
  await request('GET', '/fm/seances', (value): value is { seances: FmSeance[] } =>
    isRecord(value) && Array.isArray(value.seances) && value.seances.every(isSeance)),
  ({ seances }) => seances,
);
export const getFmSeance = (seanceId: string) => seanceRequest('GET', seancePath(seanceId));
export const archiveFmSeance = (seanceId: string) => seanceRequest('POST', `${seancePath(seanceId)}/archive`);
/** Errors: `channel-limit` (409). */
export const reopenFmSeance = (seanceId: string) => seanceRequest('POST', `${seancePath(seanceId)}/reopen`);
export const setFmSeanceItem = (seanceId: string, target: FmAttachTarget) => seanceRequest('PUT', `${seancePath(seanceId)}/item`, target);
export const removeFmSeanceItem = (seanceId: string) => seanceRequest('DELETE', `${seancePath(seanceId)}/item`);
/** Corrects lines of a capture; answers with the whole séance, its totals recomputed. */
export const correctFmCapture = (captureId: string, lines: { id: string; quantity: number; totalKamas: number }[]) =>
  seanceRequest('PUT', `/fm/captures/${encodeURIComponent(captureId)}/lines`, { lines });

export const renameFmItem = (id: string, label: string | null) =>
  request('PATCH', `/fm/items/${encodeURIComponent(id)}`, isOwnedItem, { label });

/** Errors: `no-server`, `session-not-open`. */
export function importFmCapture(lines: ImportLineRequest[], sharePrices: boolean, sessionId: string) {
  return request('POST', '/fm/imports', isImportAnswer, { sharePrices, lines, sessionId });
}

// --- Creating a séance, and its sessions ---

function isChannelRequest(value: unknown): value is FmChannelRequest {
  return isRecord(value) && typeof value.id === 'string' && (value.status === 'pending' || value.status === 'done' || value.status === 'failed');
}

/** Asks the bot for a new private channel, with a first session in it. Errors: `channel-limit` (409). */
export const createFmSeance = (name: string, target?: FmAttachTarget) =>
  request('POST', '/fm/channels', (value): value is { requestId: string } => isRecord(value) && typeof value.requestId === 'string',
    { name, ...(target ?? { fmItemId: null }) });
export const getFmChannelRequest = (id: string) => request('GET', `/fm/channel-requests/${encodeURIComponent(id)}`, isChannelRequest);

const isSessionRef = (value: unknown): value is { id: string } => isRecord(value) && typeof value.id === 'string';
const sessionPath = (sessionId: string) => `/fm/sessions/${encodeURIComponent(sessionId)}`;
/** Opens a new session in a séance. Errors: `channel-busy` (409). */
export const startFmSession = (seanceId: string) => request('POST', '/fm/sessions', isSessionRef, { channelId: seanceId });
/** Errors: `not-open` (409). */
export const stopFmSession = (sessionId: string) => request('POST', `${sessionPath(sessionId)}/stop`, isSessionRef);
export const resendFmSession = (sessionId: string) => request('POST', `${sessionPath(sessionId)}/resend`, isSessionRef);
