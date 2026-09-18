import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDeviceId } from '../../src/persistence/device-id';

describe('generic device id helper (specs/006-anonymous-visit-count)', () => {
  beforeEach(() => window.localStorage.clear());

  it('generates and persists a new id when nothing is stored yet', () => {
    const id = createDeviceId('key-a');
    expect(id).toBeTruthy();
    expect(window.localStorage.getItem('key-a')).toBe(id);
  });

  it('reuses the same id on later calls instead of regenerating one', () => {
    const first = createDeviceId('key-a');
    const second = createDeviceId('key-a');
    expect(second).toBe(first);
  });

  it('generates a different id once the stored one is cleared', () => {
    const first = createDeviceId('key-a');
    window.localStorage.clear();
    const second = createDeviceId('key-a');
    expect(second).not.toBe(first);
  });

  it('never mixes two different storage keys', () => {
    const idA = createDeviceId('key-a');
    const idB = createDeviceId('key-b');
    expect(idA).not.toBe(idB);
    expect(createDeviceId('key-a')).toBe(idA);
    expect(createDeviceId('key-b')).toBe(idB);
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
      id = createDeviceId('key-a');
    }).not.toThrow();
    expect(id).toBeTruthy();

    getItemSpy.mockRestore();
    setItemSpy.mockRestore();
  });
});
