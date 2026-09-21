import { describe, expect, it } from 'vitest';
import { formatKamasInput, normalizeKamasInput, parseKamas } from '../../src/domain/kamas';

describe('normalizeKamasInput', () => {
  it('keeps a plain digit string unchanged', () => {
    expect(normalizeKamasInput('3500')).toBe('3500');
  });

  it('strips spaces used as thousand separators', () => {
    expect(normalizeKamasInput('3 500 000')).toBe('3500000');
  });

  it('strips any non-digit character, keeping only the digits typed', () => {
    expect(normalizeKamasInput('30°00')).toBe('3000');
    expect(normalizeKamasInput('12,00')).toBe('1200');
    expect(normalizeKamasInput('abc')).toBe('');
    expect(normalizeKamasInput('1a2b3c')).toBe('123');
  });
});

describe('formatKamasInput on a digit-only value', () => {
  it('inserts thousand separators', () => {
    expect(formatKamasInput('3500000')).toBe('3 500 000');
  });
});

describe('parseKamas', () => {
  it('parses a digit-only value into a number', () => {
    expect(parseKamas('3500')).toBe(3500);
  });

  it('returns undefined for an empty value', () => {
    expect(parseKamas('')).toBeUndefined();
  });
});
