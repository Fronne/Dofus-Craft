import { describe, expect, it } from 'vitest';
import { lotPricesResponse } from '../../worker/src/lot-prices';
import { createTestD1 } from '../support/sqlite-d1';

// specs/059-prix-par-lot, contracts/community-lot-prices.md.
const url = (query: string) => new URL(`https://api.test/community-lot-prices?${query}`);

function seed() {
  const test = createTestD1();
  const insert = test.sqlite.prepare('INSERT INTO community_price_lots (resource_id, server_id, lot_size, lot_price_kamas, observed_at, device_id) VALUES (?, ?, ?, ?, ?, ?)');
  insert.run('1', 'mikhal', 10, 900, '2026-10-19T10:00:00.000Z', 'secret-key');
  insert.run('1', 'mikhal', 100, 8000, '2026-10-19T11:00:00.000Z', 'secret-key');
  insert.run('2', 'mikhal', 1, 50, '2026-10-19T12:00:00.000Z', 'secret-key');
  insert.run('1', 'dakal', 10, 1, '2026-10-19T12:00:00.000Z', 'secret-key');
  return test;
}

describe('GET /community-lot-prices', () => {
  it('gives the lot prices of the requested resources on the server, and omits resources without any', async () => {
    const { status, body } = await lotPricesResponse(seed().d1, url('serverId=mikhal&resourceIds=1,2,3,1'));
    expect(status).toBe(200);
    expect(body).toEqual({
      serverId: 'mikhal',
      prices: [
        { resourceId: '1', lots: { 10: { lotPriceKamas: 900, observedAt: '2026-10-19T10:00:00.000Z' }, 100: { lotPriceKamas: 8000, observedAt: '2026-10-19T11:00:00.000Z' } } },
        { resourceId: '2', lots: { 1: { lotPriceKamas: 50, observedAt: '2026-10-19T12:00:00.000Z' } } },
      ],
    });
  });

  it('never exposes the key that sent a price', async () => {
    expect(JSON.stringify((await lotPricesResponse(seed().d1, url('serverId=mikhal&resourceIds=1,2'))).body)).not.toContain('secret-key');
  });

  it('refuses a request without server or resources, or with too many', async () => {
    const { d1 } = seed();
    expect((await lotPricesResponse(d1, url('resourceIds=1'))).status).toBe(400);
    expect((await lotPricesResponse(d1, url('serverId=mikhal'))).status).toBe(400);
    const many = Array.from({ length: 99 }, (_, i) => i + 1).join(',');
    expect((await lotPricesResponse(d1, url(`serverId=mikhal&resourceIds=${many}`))).status).toBe(400);
  });
});
