import type { FmMe, FmPlayerSpend, FmProfile, FmSessionDetail, FmSessionsPage, PriceStatus } from '../domain/forgemagie';
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
    value.players.every((row) => isRecord(row) && isPlayer(row.player) && typeof row.spentKamas === 'number');
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
    typeof value.importedKamas === 'number' && Array.isArray(value.sessions) && isItemSummaries(value.items);
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

export function getFmSessions(before?: string | null) {
  const query = before ? `?before=${encodeURIComponent(before)}` : '';
  return request('GET', `/fm/sessions${query}`, isSessionsPage);
}

export const getFmSession = (sessionId: string) => request('GET', `/fm/sessions/${encodeURIComponent(sessionId)}`, isSessionDetail);
export const getFmPlayers = () => request('GET', '/fm/players', isPlayers);
export const getFmPlayer = (discordUserId: string) => request('GET', `/fm/players/${encodeURIComponent(discordUserId)}`, isProfile);

export function importFmCapture(lines: ImportLineRequest[], sharePrices: boolean) {
  return request('POST', '/fm/imports', isImportAnswer, { sharePrices, lines });
}
