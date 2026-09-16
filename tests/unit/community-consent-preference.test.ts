import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getShareConsent, setShareConsent } from '../../src/persistence/community-consent-preference';

describe('community share consent preference', () => {
  beforeEach(() => window.localStorage.clear());

  it('defaults to false when nothing is stored', () => {
    expect(getShareConsent()).toBe(false);
  });

  it('persists a value across a simulated reload', () => {
    setShareConsent(true);
    expect(getShareConsent()).toBe(true);

    setShareConsent(false);
    expect(getShareConsent()).toBe(false);
  });

  it('never throws when localStorage is unavailable, defaulting to false', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: storage is disabled');
    });

    expect(() => getShareConsent()).not.toThrow();
    expect(getShareConsent()).toBe(false);

    getItemSpy.mockRestore();
  });

  it('never throws when localStorage is unavailable on write', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError: storage is disabled');
    });

    expect(() => setShareConsent(true)).not.toThrow();

    setItemSpy.mockRestore();
  });
});
