import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { catalogueCache } from '../../src/persistence/indexeddb-catalogue-cache-store';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe('catalogueCache', () => {
  it('returns undefined for a key that was never written', async () => {
    expect(await catalogueCache.get('categories')).toBeUndefined();
  });

  it('round-trips a value written with set, alongside a valid ISO savedAt', async () => {
    const savedAt = await catalogueCache.set('categories', [{ id: 'cat-1' }]);

    expect(new Date(savedAt).toISOString()).toBe(savedAt);
    expect(await catalogueCache.get('categories')).toEqual({ value: [{ id: 'cat-1' }], savedAt });
  });

  it('overwrites a previous entry for the same key and advances savedAt', async () => {
    const firstSavedAt = await catalogueCache.set('search:épée::: 12', ['item-1']);
    await new Promise((resolve) => setTimeout(resolve, 2));
    const secondSavedAt = await catalogueCache.set('search:épée::: 12', ['item-1', 'item-2']);

    expect(secondSavedAt >= firstSavedAt).toBe(true);
    expect(await catalogueCache.get('search:épée::: 12')).toEqual({
      value: ['item-1', 'item-2'],
      savedAt: secondSavedAt,
    });
  });

  it('keeps entries for distinct keys independent', async () => {
    await catalogueCache.set('categories', ['a']);
    await catalogueCache.set('detail:item-1', ['b']);

    expect(await catalogueCache.get('categories')).toMatchObject({ value: ['a'] });
    expect(await catalogueCache.get('detail:item-1')).toMatchObject({ value: ['b'] });
  });
});
