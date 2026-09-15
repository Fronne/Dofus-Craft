import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { createServerScopedPriceStore } from '../../src/persistence/server-scoped-price-store';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe('createServerScopedPriceStore', () => {
  it('keeps entries for distinct serverId values from interfering with each other', async () => {
    const store = createServerScopedPriceStore('resource-prices-by-server');

    await store.save('mikhal', 'resource-1', 100);
    await store.save('dakal', 'resource-1', 250);

    expect(await store.get('mikhal', 'resource-1')).toMatchObject({ amountKamas: 100 });
    expect(await store.get('dakal', 'resource-1')).toMatchObject({ amountKamas: 250 });
  });

  it('leaves previously stored entries unchanged when a brand-new serverId is introduced', async () => {
    const store = createServerScopedPriceStore('pinned-item-prices-by-server');

    await store.save('mikhal', 'item-1', 100);
    await store.save('dakal', 'item-1', 250);

    const brandNewServerEntries = await store.getMany('salar', ['item-1']);
    expect(brandNewServerEntries).toEqual({});

    expect(await store.get('mikhal', 'item-1')).toMatchObject({ amountKamas: 100 });
    expect(await store.get('dakal', 'item-1')).toMatchObject({ amountKamas: 250 });
  });
});
