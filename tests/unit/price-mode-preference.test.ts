import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPriceMode, setPriceMode } from '../../src/persistence/price-mode-preference';

describe('price mode preference', () => {
  beforeEach(() => window.localStorage.clear());

  it('defaults to personal mode when nothing is stored', () => {
    expect(getPriceMode()).toBe('personal');
  });

  it('defaults to personal mode when the stored value is invalid', () => {
    window.localStorage.setItem('craftcheck-price-mode', 'nonsense');
    expect(getPriceMode()).toBe('personal');
  });

  it('persists a valid choice across a simulated reload', () => {
    setPriceMode('community');
    expect(getPriceMode()).toBe('community');
  });

  it('rejects an unknown price mode', () => {
    expect(() => setPriceMode('offline' as never)).toThrow();
  });

  it('treats an unavailable localStorage as no preference, defaulting to personal, without throwing', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: storage is disabled');
    });

    expect(() => getPriceMode()).not.toThrow();
    expect(getPriceMode()).toBe('personal');

    getItemSpy.mockRestore();
  });
});
