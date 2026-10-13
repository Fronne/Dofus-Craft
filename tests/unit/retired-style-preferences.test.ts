import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearRetiredStylePreferences } from '../../src/persistence/retired-style-preferences';

// specs/051-site-visual-refresh (FR-027): the design and accent a device remembered are dropped.
describe('clearRetiredStylePreferences', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('forgets the design and the accent color, and nothing else', () => {
    window.localStorage.setItem('craftcheck-design-choice', 'modern');
    window.localStorage.setItem('craftcheck-accent-color', 'violet');
    window.localStorage.setItem('craftcheck-theme', 'light');

    clearRetiredStylePreferences();

    expect(window.localStorage.getItem('craftcheck-design-choice')).toBeNull();
    expect(window.localStorage.getItem('craftcheck-accent-color')).toBeNull();
    expect(window.localStorage.getItem('craftcheck-theme')).toBe('light');
  });

  it('does nothing, without an error, when the storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });

    expect(() => clearRetiredStylePreferences()).not.toThrow();
  });
});
