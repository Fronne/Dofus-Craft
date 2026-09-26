// specs/020-info-banner (data-model.md): the one information message shown as a banner, shared by
// the public site, the administration page and both Workers — one set of rules for all of them.
export type InfoTone = 'info' | 'important';

export type InfoMessage = { text: string; tone: InfoTone; endsAt: string | null; version: string };

export type InfoMessageInput = { text: string; tone: InfoTone; endsAt: string | null };

export type InfoMessageValidation = { ok: true; value: InfoMessageInput } | { ok: false; field: 'text' | 'tone' | 'endsAt'; error: string };

export const INFO_MESSAGE_MAX_LENGTH = 280;

function isTone(value: unknown): value is InfoTone {
  return value === 'info' || value === 'important';
}

export function validateInfoMessageInput(input: unknown, now: Date = new Date()): InfoMessageValidation {
  const record = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  const text = typeof record.text === 'string' ? record.text.trim() : '';
  if (!text) return { ok: false, field: 'text', error: 'Le message ne peut pas être vide.' };
  if (text.length > INFO_MESSAGE_MAX_LENGTH) return { ok: false, field: 'text', error: `${INFO_MESSAGE_MAX_LENGTH} caractères au plus.` };
  if (!isTone(record.tone)) return { ok: false, field: 'tone', error: 'Style inconnu.' };
  let endsAt: string | null = null;
  if (record.endsAt !== undefined && record.endsAt !== null && record.endsAt !== '') {
    const time = typeof record.endsAt === 'string' ? Date.parse(record.endsAt) : Number.NaN;
    if (Number.isNaN(time) || time <= now.getTime()) {
      return { ok: false, field: 'endsAt', error: 'La date de fin doit être dans le futur.' };
    }
    endsAt = new Date(time).toISOString();
  }
  return { ok: true, value: { text, tone: record.tone, endsAt } };
}

// FR-006: shown only until its end date, when it has one.
export function isInfoMessageActive(message: Pick<InfoMessage, 'endsAt'>, now: Date = new Date()): boolean {
  return message.endsAt === null || Date.parse(message.endsAt) > now.getTime();
}

export function isInfoMessage(value: unknown): value is InfoMessage {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.text === 'string' && isTone(record.tone) &&
    (record.endsAt === null || typeof record.endsAt === 'string') && typeof record.version === 'string';
}
