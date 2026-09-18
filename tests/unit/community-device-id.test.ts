import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getOrCreateDeviceId } from '../../src/persistence/community-device-id';

describe('community device id (specs/004-community-price-sharing revision 5)', () => {
  beforeEach(() => window.localStorage.clear());

  it('generates and persists a new id when nothing is stored yet', () => {
    const id = getOrCreateDeviceId();
    expect(id).toBeTruthy();
    expect(window.localStorage.getItem('craftcheck-community-device-id')).toBe(id);
  });

  it('reuses the same id on later calls instead of regenerating one', () => {
    const first = getOrCreateDeviceId();
    const second = getOrCreateDeviceId();
    expect(second).toBe(first);
  });

  it('generates a different id once the stored one is cleared', () => {
    const first = getOrCreateDeviceId();
    window.localStorage.clear();
    const second = getOrCreateDeviceId();
    expect(second).not.toBe(first);
  });

  it('still returns a non-empty id, without throwing, when localStorage is unavailable', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: storage is disabled');
    });
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError: storage is disabled');
    });

    let id = '';
    expect(() => {
      id = getOrCreateDeviceId();
    }).not.toThrow();
    expect(id).toBeTruthy();

    getItemSpy.mockRestore();
    setItemSpy.mockRestore();
  });
});
