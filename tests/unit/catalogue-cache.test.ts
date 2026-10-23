import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cached, clearCache, hydrateFromPersistentStore, peekCached, PERSISTED_FRESH_MS, seedCache, setPersistentStore } from '../../src/data/catalogue-cache';
import { catalogueCache } from '../../src/persistence/indexeddb-catalogue-cache-store';

const flush = () => new Promise((resolve) => setTimeout(resolve, 20));

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  setPersistentStore(catalogueCache);
  clearCache();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('cached (specs/021 persistent catalogue)', () => {
  it('serves a later visit from the device copy, without calling the loader', async () => {
    await cached('item:1', () => Promise.resolve({ id: 1 }));
    await flush();
    clearCache();
    const loader = vi.fn(() => Promise.resolve({ id: 2 }));

    expect(await cached('item:1', loader)).toEqual({ id: 1 });
    expect(loader).not.toHaveBeenCalled();
  });

  it('serves a stale device copy at once and refreshes it once in the background', async () => {
    await cached('item:1', () => Promise.resolve({ id: 1 }));
    await flush();
    clearCache();
    const realNow = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(realNow + PERSISTED_FRESH_MS + 1000);
    const loader = vi.fn(() => Promise.resolve({ id: 2 }));

    expect(await cached('item:1', loader)).toEqual({ id: 1 });
    await flush();
    expect(loader).toHaveBeenCalledTimes(1);
    expect(await catalogueCache.getVersioned('item:1')).toMatchObject({ value: { id: 2 } });
    vi.restoreAllMocks();
  });

  it('falls back to the network when the device store fails', async () => {
    setPersistentStore({
      getVersioned: () => Promise.reject(new Error('blocked')),
      set: () => Promise.reject(new Error('blocked')),
    });

    expect(await cached('item:1', () => Promise.resolve('network'))).toBe('network');
  });

  it('deduplicates concurrent reads into a single load', async () => {
    const loader = vi.fn(() => Promise.resolve('value'));

    const [a, b] = await Promise.all([cached('k', loader), cached('k', loader)]);

    expect([a, b]).toEqual(['value', 'value']);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('lets a failed load be retried', async () => {
    await expect(cached('k', () => Promise.reject(new Error('down')))).rejects.toThrow('down');

    expect(await cached('k', () => Promise.resolve('ok'))).toBe('ok');
  });

  it('hydrateFromPersistentStore makes device entries visible to peekCached', async () => {
    await catalogueCache.set('catalogue-item-index', { items: [1] });

    await hydrateFromPersistentStore(['catalogue-item-index', 'missing']);

    expect(peekCached('catalogue-item-index')).toEqual({ items: [1] });
    expect(peekCached('missing')).toBeUndefined();
  });
});

describe('seedCache (specs/072 snapshot)', () => {
  it('is not overwritten by a device copy read after the seed', async () => {
    await catalogueCache.set('index', { old: true });
    clearCache();
    const pending = cached('index', () => Promise.resolve({ network: true }));
    seedCache('index', { snapshot: true });

    expect(await pending).toEqual({ snapshot: true });
    expect(peekCached('index')).toEqual({ snapshot: true });
  });

  it('writes the device copy only once the page has settled, not at seed time', async () => {
    vi.useFakeTimers();
    const set = vi.fn((_key: string, _value: unknown) => Promise.resolve('saved'));
    setPersistentStore({ getVersioned: () => Promise.resolve(undefined), set });

    seedCache('index', { snapshot: true });
    seedCache('sets', { snapshot: true });

    expect(peekCached('index')).toEqual({ snapshot: true });
    await vi.advanceTimersByTimeAsync(1000);
    expect(set).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(10_000 + 1000);
    expect(set.mock.calls.map(([key]) => key)).toEqual(['index', 'sets']);
  });
});
