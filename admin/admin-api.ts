import { isInfoMessage, type InfoMessage, type InfoMessageInput } from '../src/domain/info-message';
import { parseSiteSettings, type SiteSettingsChange } from '../src/domain/site-settings';
import { isPlayerCounter, type PlayerCounter, type PlayerCounterInput } from '../src/domain/player-counter';
import type { SnifferKeyJson } from '../admin-worker/src/sniffer-keys';
import type { MappingUpload, SnifferMappingJson } from '../admin-worker/src/sniffer-mappings';

// specs/014-admin-counters (contracts/player-counters-api.md): same-origin calls to the
// dofus-craft-admin API; the Cloudflare Access session cookie rides along. Never throws.
export type AdminResult<T> =
  | { status: 'ok'; value: T }
  | { status: 'invalid'; field: string; error: string }
  | { status: 'forbidden' }
  | { status: 'not-found' }
  | { status: 'unavailable' };

async function call<T>(method: string, path: string, body: unknown, read: (payload: unknown) => T | undefined): Promise<AdminResult<T>> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { status: 'unavailable' };
  }
  if (response.status === 403) return { status: 'forbidden' };
  if (response.status === 404) return { status: 'not-found' };
  if (response.status === 204) return { status: 'ok', value: undefined as T };
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { status: 'unavailable' };
  }
  if (response.status === 400) {
    const record = (payload ?? {}) as Record<string, unknown>;
    return { status: 'invalid', field: String(record.field ?? ''), error: String(record.error ?? 'Valeur invalide.') };
  }
  if (!response.ok) return { status: 'unavailable' };
  const value = read(payload);
  return value === undefined ? { status: 'unavailable' } : { status: 'ok', value };
}

const asCounter = (payload: unknown) => (isPlayerCounter(payload) ? payload : undefined);

// specs/057-sniffer-admin (contracts/admin-sniffer-api.md): the friends' keys and the mappings.
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isDateOrNull = (value: unknown) => value === null || typeof value === 'string';

export function isSnifferKey(value: unknown): value is SnifferKeyJson {
  return isRecord(value) && typeof value.id === 'string' && typeof value.label === 'string' && typeof value.createdAt === 'string' &&
    isDateOrNull(value.revokedAt) && isDateOrNull(value.lastSeenAt) && typeof value.rowsToday === 'number';
}

export function isSnifferMapping(value: unknown): value is SnifferMappingJson {
  return isRecord(value) && typeof value.id === 'number' && typeof value.build === 'string' && typeof value.uploadedAt === 'string' &&
    typeof value.active === 'boolean' && typeof value.keymapBytes === 'number' && typeof value.schemaBytes === 'number';
}

const asSnifferKey = (payload: unknown) => (isSnifferKey(payload) ? payload : undefined);
const asSnifferMapping = (payload: unknown) => (isSnifferMapping(payload) ? payload : undefined);

export const adminApi = {
  me: () => call('GET', '/me', undefined, (payload) => {
    const email = (payload as Record<string, unknown> | null)?.email;
    return typeof email === 'string' ? email : undefined;
  }),
  list: () => call('GET', '/counters', undefined, (payload) =>
    (Array.isArray(payload) && payload.every(isPlayerCounter) ? payload : undefined)),
  create: (input: PlayerCounterInput) => call('POST', '/counters', input, asCounter),
  update: (id: string, patch: Partial<PlayerCounterInput>) =>
    call('PATCH', `/counters/${encodeURIComponent(id)}`, patch, asCounter),
  // specs/020-info-banner: the information banner's message (`null` when none).
  getMessage: () => call<InfoMessage | null>('GET', '/message', undefined, (payload) =>
    (payload === null || isInfoMessage(payload) ? payload : undefined)),
  saveMessage: (input: InfoMessageInput) => call('PUT', '/message', input, (payload) => (isInfoMessage(payload) ? payload : undefined)),
  deleteMessage: () => call<void>('DELETE', '/message', undefined, () => undefined),
  // specs/050-forgemagie-page-toggle: the site settings; saving answers with what is now saved.
  // specs/053-hdv-page-toggle: only the settings changed are sent, so one never overwrites the other.
  getSettings: () => call('GET', '/settings', undefined, parseSiteSettings),
  saveSettings: (change: SiteSettingsChange) => call('PUT', '/settings', change, parseSiteSettings),
  remove: (id: string) => call<void>('DELETE', `/counters/${encodeURIComponent(id)}`, undefined, () => undefined),
  // specs/057-sniffer-admin: the key itself (secret) is only in the creation's answer.
  listSnifferKeys: () => call('GET', '/sniffer/keys', undefined, (payload) =>
    (Array.isArray(payload) && payload.every(isSnifferKey) ? payload : undefined)),
  createSnifferKey: (label: string) => call('POST', '/sniffer/keys', { label }, (payload) => {
    const record = isRecord(payload) ? payload : {};
    return isSnifferKey(record.key) && typeof record.secret === 'string' ? { key: record.key, secret: record.secret } : undefined;
  }),
  revokeSnifferKey: (id: string) => call('POST', `/sniffer/keys/${encodeURIComponent(id)}/revoke`, undefined, asSnifferKey),
  listSnifferMappings: () => call('GET', '/sniffer/mappings', undefined, (payload) =>
    (Array.isArray(payload) && payload.every(isSnifferMapping) ? payload : undefined)),
  uploadSnifferMapping: (upload: MappingUpload) => call('POST', '/sniffer/mappings', upload, asSnifferMapping),
  activateSnifferMapping: (id: number) => call('POST', `/sniffer/mappings/${id}/activate`, undefined, asSnifferMapping),
};

export type { PlayerCounter, SnifferKeyJson, SnifferMappingJson };
