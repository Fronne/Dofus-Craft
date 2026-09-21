import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { pinnedItemPrices } from '../../src/persistence/indexeddb-pinned-item-price-repository';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe('pinned item market price persistence', () => {
  it('returns undefined for an item with no saved market price on a server', async () => {
    expect(await pinnedItemPrices.get('mikhal', 'item-1')).toBeUndefined();
  });

  it('saves a market price and reads it back with an updatedAt timestamp', async () => {
    const saved = await pinnedItemPrices.save('mikhal', 'item-1', 500000);
    expect(saved).toMatchObject({ itemId: 'item-1', marketPriceKamas: 500000 });
    expect(saved.updatedAt).toEqual(expect.any(String));

    expect(await pinnedItemPrices.get('mikhal', 'item-1')).toEqual(saved);
  });

  it('overwrites a previously saved market price for the same server and item', async () => {
    await pinnedItemPrices.save('mikhal', 'item-1', 500000);
    const overwritten = await pinnedItemPrices.save('mikhal', 'item-1', 600000);
    expect(overwritten.marketPriceKamas).toBe(600000);
  });

  it('reloads saved market prices for many items at once', async () => {
    await pinnedItemPrices.save('mikhal', 'item-1', 500000);
    await pinnedItemPrices.save('mikhal', 'item-2', 100);

    const many = await pinnedItemPrices.getMany('mikhal', ['item-1', 'item-2', 'item-3']);
    expect(many['item-1']).toMatchObject({ marketPriceKamas: 500000 });
    expect(many['item-2']).toMatchObject({ marketPriceKamas: 100 });
    expect(many['item-3']).toBeUndefined();
  });

  it('isolates market prices between two distinct servers for the same item', async () => {
    await pinnedItemPrices.save('mikhal', 'item-1', 500000);
    await pinnedItemPrices.save('dakal', 'item-1', 750000);

    expect(await pinnedItemPrices.get('mikhal', 'item-1')).toMatchObject({ marketPriceKamas: 500000 });
    expect(await pinnedItemPrices.get('dakal', 'item-1')).toMatchObject({ marketPriceKamas: 750000 });
  });

  it('removes the market price of an item for every server when it is unpinned', async () => {
    await pinnedItemPrices.save('mikhal', 'item-1', 500000);
    await pinnedItemPrices.save('dakal', 'item-1', 750000);
    await pinnedItemPrices.save('mikhal', 'item-2', 100);

    await pinnedItemPrices.removeAllForItem('item-1');

    expect(await pinnedItemPrices.get('mikhal', 'item-1')).toBeUndefined();
    expect(await pinnedItemPrices.get('dakal', 'item-1')).toBeUndefined();
    expect(await pinnedItemPrices.get('mikhal', 'item-2')).toMatchObject({ marketPriceKamas: 100 });
  });

  it('removes the market price of an item for a single server only, leaving other servers untouched', async () => {
    await pinnedItemPrices.save('mikhal', 'item-1', 500000);
    await pinnedItemPrices.save('dakal', 'item-1', 750000);

    await pinnedItemPrices.remove('mikhal', 'item-1');

    expect(await pinnedItemPrices.get('mikhal', 'item-1')).toBeUndefined();
    expect(await pinnedItemPrices.get('dakal', 'item-1')).toMatchObject({ marketPriceKamas: 750000 });
  });

  it('lists every saved item price for a server, with no notion of pin state at this layer', async () => {
    await pinnedItemPrices.save('mikhal', 'item-1', 500000);
    await pinnedItemPrices.save('mikhal', 'item-2', 100);
    await pinnedItemPrices.save('dakal', 'item-3', 42);

    const rows = await pinnedItemPrices.listAllForServer('mikhal');

    expect(rows).toHaveLength(2);
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ itemId: 'item-1', marketPriceKamas: 500000 }),
      expect.objectContaining({ itemId: 'item-2', marketPriceKamas: 100 }),
    ]));
  });
});
