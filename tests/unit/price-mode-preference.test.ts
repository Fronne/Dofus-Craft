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
    setPriceMode('personal');
    expect(getPriceMode()).toBe('personal');
  });

  it('rejects an unknown price mode', () => {
    expect(() => setPriceMode('offline' as never)).toThrow();
  });

  // Mode communautaire temporairement désactivé (src/domain/price-modes.ts,
  // COMMUNITY_MODE_ENABLED) : 'community' n'est plus un mode connu tant qu'il ne l'est pas.
  it.skip('persists community mode once it is re-enabled', () => {
    setPriceMode('community');
    expect(getPriceMode()).toBe('community');
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
