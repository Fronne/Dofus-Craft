import { describe, expect, it } from 'vitest';
import { isInfoMessageActive, validateInfoMessageInput } from '../../src/domain/info-message';

// specs/020-info-banner, data-model.md « Entrée de publication ».
const NOW = new Date('2026-09-26T12:00:00.000Z');

describe('validateInfoMessageInput (specs/020)', () => {
  it('accepts a message, trimmed, without an end date', () => {
    expect(validateInfoMessageInput({ text: '  Maintenance mardi  ', tone: 'important' }, NOW)).toEqual({
      ok: true, value: { text: 'Maintenance mardi', tone: 'important', endsAt: null },
    });
    expect(validateInfoMessageInput({ text: 'a'.repeat(280), tone: 'info', endsAt: null }, NOW).ok).toBe(true);
  });

  it('accepts a future end date, normalized to ISO', () => {
    expect(validateInfoMessageInput({ text: 'x', tone: 'info', endsAt: '2026-10-01T20:00:00+02:00' }, NOW)).toEqual({
      ok: true, value: { text: 'x', tone: 'info', endsAt: '2026-10-01T18:00:00.000Z' },
    });
  });

  it.each([
    [{ text: '   ', tone: 'info' }, 'text', 'Le message ne peut pas être vide.'],
    [{ text: 'a'.repeat(281), tone: 'info' }, 'text', '280 caractères au plus.'],
    [{ text: 'x', tone: 'urgent' }, 'tone', 'Style inconnu.'],
    [{ text: 'x', tone: 'info', endsAt: 'demain' }, 'endsAt', 'La date de fin doit être dans le futur.'],
    [{ text: 'x', tone: 'info', endsAt: '2026-09-26T11:59:00.000Z' }, 'endsAt', 'La date de fin doit être dans le futur.'],
  ])('refuses %j', (input, field, error) => {
    expect(validateInfoMessageInput(input, NOW)).toEqual({ ok: false, field, error });
  });
});

describe('isInfoMessageActive (specs/020 FR-006)', () => {
  it('is active without an end date or before it, not after', () => {
    expect(isInfoMessageActive({ endsAt: null }, NOW)).toBe(true);
    expect(isInfoMessageActive({ endsAt: '2026-09-26T12:01:00.000Z' }, NOW)).toBe(true);
    expect(isInfoMessageActive({ endsAt: '2026-09-26T12:00:00.000Z' }, NOW)).toBe(false);
  });
});
