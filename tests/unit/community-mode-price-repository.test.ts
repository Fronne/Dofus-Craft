import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { communityModePrices } from '../../src/persistence/indexeddb-community-mode-price-repository';
import { prices } from '../../src/persistence/indexeddb-resource-price-repository';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe('community-mode price carnet persistence', () => {
  it('returns undefined for a resource with no saved community-mode price on a server', async () => {
    expect(await communityModePrices.get('mikhal', 'resource-1')).toBeUndefined();
  });

  it('saves a community-mode price and reads it back with an updatedAt timestamp', async () => {
    const saved = await communityModePrices.save('mikhal', 'resource-1', 500);
    expect(saved).toMatchObject({ resourceId: 'resource-1', unitPriceKamas: 500 });
    expect(saved.updatedAt).toEqual(expect.any(String));

    expect(await communityModePrices.get('mikhal', 'resource-1')).toEqual(saved);
  });

  it('overwrites a previously saved community-mode price for the same server and resource', async () => {
    await communityModePrices.save('mikhal', 'resource-1', 500);
    const overwritten = await communityModePrices.save('mikhal', 'resource-1', 600);
    expect(overwritten.unitPriceKamas).toBe(600);
  });

  it('reloads saved community-mode prices for many resources at once', async () => {
    await communityModePrices.save('mikhal', 'resource-1', 500);
    await communityModePrices.save('mikhal', 'resource-2', 100);

    const many = await communityModePrices.getMany('mikhal', ['resource-1', 'resource-2', 'resource-3']);
    expect(many['resource-1']).toMatchObject({ unitPriceKamas: 500 });
    expect(many['resource-2']).toMatchObject({ unitPriceKamas: 100 });
    expect(many['resource-3']).toBeUndefined();
  });

  it('isolates community-mode prices between two distinct servers for the same resource', async () => {
    await communityModePrices.save('mikhal', 'resource-1', 500);
    await communityModePrices.save('dakal', 'resource-1', 750);

    expect(await communityModePrices.get('mikhal', 'resource-1')).toMatchObject({ unitPriceKamas: 500 });
    expect(await communityModePrices.get('dakal', 'resource-1')).toMatchObject({ unitPriceKamas: 750 });
  });

  it('lists every saved community-mode price for a server', async () => {
    await communityModePrices.save('mikhal', 'resource-1', 500);
    await communityModePrices.save('mikhal', 'resource-2', 100);
    await communityModePrices.save('dakal', 'resource-3', 42);

    const rows = await communityModePrices.listAllForServer('mikhal');

    expect(rows).toHaveLength(2);
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ resourceId: 'resource-1', unitPriceKamas: 500 }),
      expect.objectContaining({ resourceId: 'resource-2', unitPriceKamas: 100 }),
    ]));
  });

  // FR-005: the two carnets must be physically independent stores, never a filter on a shared
  // one — proven here by writing through one repository and reading through the other.
  it('never shows a price saved in the Mode personnel carnet through the Mode communautaire carnet', async () => {
    await prices.save('mikhal', 'resource-1', 500);

    expect(await communityModePrices.get('mikhal', 'resource-1')).toBeUndefined();
    expect(await communityModePrices.listAllForServer('mikhal')).toHaveLength(0);
  });

  it('never shows a price saved in the Mode communautaire carnet through the Mode personnel carnet', async () => {
    await communityModePrices.save('mikhal', 'resource-1', 700);

    expect(await prices.get('mikhal', 'resource-1')).toBeUndefined();
    expect(await prices.listAllForServer('mikhal')).toHaveLength(0);
  });
});
