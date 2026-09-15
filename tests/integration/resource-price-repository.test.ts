import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { prices } from '../../src/persistence/indexeddb-resource-price-repository';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe('resource price persistence', () => {
  it('returns undefined for a resource with no saved price on a server', async () => {
    expect(await prices.get('mikhal', 'resource-1')).toBeUndefined();
  });

  it('saves a price and reads it back with an updatedAt timestamp', async () => {
    const saved = await prices.save('mikhal', 'resource-1', 1000);
    expect(saved).toMatchObject({ resourceId: 'resource-1', unitPriceKamas: 1000 });
    expect(saved.updatedAt).toEqual(expect.any(String));

    const fetched = await prices.get('mikhal', 'resource-1');
    expect(fetched).toEqual(saved);
  });

  it('overwrites a previously saved price for the same server and resource', async () => {
    await prices.save('mikhal', 'resource-1', 1000);
    const overwritten = await prices.save('mikhal', 'resource-1', 2000);
    expect(overwritten.unitPriceKamas).toBe(2000);
    expect(await prices.get('mikhal', 'resource-1')).toMatchObject({ unitPriceKamas: 2000 });
  });

  it('reloads saved prices for many resources at once', async () => {
    await prices.save('mikhal', 'resource-1', 1000);
    await prices.save('mikhal', 'resource-2', 500);

    const many = await prices.getMany('mikhal', ['resource-1', 'resource-2', 'resource-3']);
    expect(many['resource-1']).toMatchObject({ unitPriceKamas: 1000 });
    expect(many['resource-2']).toMatchObject({ unitPriceKamas: 500 });
    expect(many['resource-3']).toBeUndefined();
  });

  it('removes a saved price for a server', async () => {
    await prices.save('mikhal', 'resource-1', 1000);
    await prices.remove('mikhal', 'resource-1');
    expect(await prices.get('mikhal', 'resource-1')).toBeUndefined();
  });

  it('isolates prices between two distinct servers for the same resource', async () => {
    await prices.save('mikhal', 'resource-1', 1000);
    await prices.save('dakal', 'resource-1', 3000);

    expect(await prices.get('mikhal', 'resource-1')).toMatchObject({ unitPriceKamas: 1000 });
    expect(await prices.get('dakal', 'resource-1')).toMatchObject({ unitPriceKamas: 3000 });

    await prices.remove('mikhal', 'resource-1');
    expect(await prices.get('mikhal', 'resource-1')).toBeUndefined();
    expect(await prices.get('dakal', 'resource-1')).toMatchObject({ unitPriceKamas: 3000 });
  });

  it('reports storage failures for an invalid price without throwing an unhandled error', async () => {
    await expect(prices.save('mikhal', 'resource-1', -1)).rejects.toThrow();
    await expect(prices.save('mikhal', 'resource-1', 1.5)).rejects.toThrow();
  });
});
