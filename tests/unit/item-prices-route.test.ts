import { describe, expect, it } from 'vitest';
import { itemPricesResponse } from '../../worker/src/latest';
import { createTestD1 } from '../support/sqlite-d1';

// specs/019-craft-profit-list, contracts/item-prices-api.md.
const url = (query: string) => new URL(`https://api.test/item-prices?${query}`);

describe('GET /item-prices (specs/019)', () => {
  it('answers 400 without a server', async () => {
    const { d1 } = createTestD1();
    await expect(itemPricesResponse(d1, url(''))).resolves.toEqual({ status: 400, body: { error: 'serverId is required' } });
  });

  it('answers 200 with an empty list without data', async () => {
    const { d1 } = createTestD1();
    await expect(itemPricesResponse(d1, url('serverId=mikhal'))).resolves.toEqual({ status: 200, body: { items: [] } });
  });

  it("keeps only each item's latest price, one entry per item", async () => {
    const { d1, insert } = createTestD1();
    insert({ resourceId: '44', amountKamas: 1000, createdAt: '2026-09-20T10:00:00.000Z', kind: 'item' });
    insert({ resourceId: '44', amountKamas: 1200, createdAt: '2026-09-24T10:00:00.000Z', kind: 'item' });
    insert({ resourceId: '45', amountKamas: 5000, createdAt: '2026-09-22T10:00:00.000Z', kind: 'item' });
    const { body } = await itemPricesResponse(d1, url('serverId=mikhal'));
    expect((body as { items: unknown[] }).items).toEqual(expect.arrayContaining([
      { itemId: '44', amountKamas: 1200, contributedAt: '2026-09-24T10:00:00.000Z' },
      { itemId: '45', amountKamas: 5000, contributedAt: '2026-09-22T10:00:00.000Z' },
    ]));
    expect((body as { items: unknown[] }).items).toHaveLength(2);
  });

  it('ignores resource prices and other servers, and never exposes a device id', async () => {
    const { d1, insert } = createTestD1();
    insert({ resourceId: '44', amountKamas: 1000, createdAt: '2026-09-20T10:00:00.000Z', kind: 'resource' });
    insert({ resourceId: '46', serverId: 'dakal', amountKamas: 3000, createdAt: '2026-09-20T10:00:00.000Z', kind: 'item' });
    insert({ resourceId: '47', amountKamas: 7000, createdAt: '2026-09-20T10:00:00.000Z', kind: 'item', deviceId: 'device-secret' });
    const { body } = await itemPricesResponse(d1, url('serverId=mikhal'));
    expect(body).toEqual({ items: [{ itemId: '47', amountKamas: 7000, contributedAt: '2026-09-20T10:00:00.000Z' }] });
    expect(JSON.stringify(body)).not.toMatch(/device/);
  });
});
