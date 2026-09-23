import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPriceMode, setPriceMode } from '../../src/persistence/price-mode-preference';

describe('price mode preference', () => {
  beforeEach(() => window.localStorage.clear());

  it('defaults to community mode for a new player (nothing stored)', () => {
    expect(getPriceMode()).toBe('community');
  });

  it('defaults to community mode when the stored value is invalid', () => {
    window.localStorage.setItem('craftcheck-price-mode', 'nonsense');
    expect(getPriceMode()).toBe('community');
  });

  it('keeps an existing player on the mode they already have', () => {
    setPriceMode('personal');
    expect(getPriceMode()).toBe('personal');
  });

  it('persists a valid choice across a simulated reload', () => {
    setPriceMode('personal');
    expect(getPriceMode()).toBe('personal');
  });

  it('rejects an unknown price mode', () => {
    expect(() => setPriceMode('offline' as never)).toThrow();
  });

  it('persists community mode', () => {
    setPriceMode('community');
    expect(getPriceMode()).toBe('community');
  });

  it('treats an unavailable localStorage as no preference, defaulting to community, without throwing', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: storage is disabled');
    });

    expect(() => getPriceMode()).not.toThrow();
    expect(getPriceMode()).toBe('community');

    getItemSpy.mockRestore();
  });
});
