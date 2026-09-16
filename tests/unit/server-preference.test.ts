import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getActiveServerId, setActiveServerId } from '../../src/persistence/server-preference';

describe('active server preference', () => {
  beforeEach(() => window.localStorage.clear());

  it('is absent before any selection has been made', () => {
    expect(getActiveServerId()).toBeUndefined();
  });

  it('is a synchronous read available immediately after selection', () => {
    setActiveServerId('mikhal');
    expect(getActiveServerId()).toBe('mikhal');
  });

  it('persists across a simulated reload (a fresh read from storage)', () => {
    setActiveServerId('dakal');
    // Simulate a reload: nothing but localStorage survives.
    expect(getActiveServerId()).toBe('dakal');
  });

  it('treats an unavailable localStorage (e.g. private browsing) as no preference, without throwing (FR-017)', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: storage is disabled');
    });

    expect(() => getActiveServerId()).not.toThrow();
    expect(getActiveServerId()).toBeUndefined();

    getItemSpy.mockRestore();
  });

  it('does not validate the stored id against the server list — the list is now fetched from DofusDB, so ServerContext cross-checks it once loaded instead', () => {
    window.localStorage.setItem('craftcheck-active-server', 'atlantis');
    expect(getActiveServerId()).toBe('atlantis');
  });
});
