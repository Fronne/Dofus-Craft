import { describe, expect, it } from 'vitest';
import { PURGE_SQL, purgeExpiredContributions, retentionCutoff } from '../../worker/src/retention';
import { createTestD1 } from '../support/sqlite-d1';

const NOW = new Date('2026-09-23T12:00:00.000Z');

describe('retention (specs/004-community-price-sharing FR-013)', () => {
  it('cuts off exactly 90 days before now', () => {
    expect(retentionCutoff(NOW)).toBe('2026-06-25T12:00:00.000Z');
  });

  it('deletes only the contributions older than the cutoff and reports how many', async () => {
    const calls: { sql: string; params: unknown[] }[] = [];
    const db = {
      prepare: (sql: string) => ({
        bind: (...params: unknown[]) => ({
          run: async () => {
            calls.push({ sql, params });
            return { meta: { changes: 3 } };
          },
        }),
      }),
    };

    await expect(purgeExpiredContributions(db, NOW)).resolves.toBe(3);
    expect(calls).toEqual([{
      sql: PURGE_SQL,
      params: ['2026-06-25T12:00:00.000Z'],
    }]);
  });
});

describe('retention keeps the latest item price (specs/016, révision de specs/004 FR-013)', () => {
  it('spares only the most recent old item row of each item and server; old resource rows all go', async () => {
    const { d1, insert, rows } = createTestD1();
    const old1 = '2026-01-10T10:00:00.000Z';
    const old2 = '2026-02-10T10:00:00.000Z';
    const recent = '2026-09-20T10:00:00.000Z';
    insert({ resourceId: '208', amountKamas: 5000, createdAt: old1, kind: 'item' });
    insert({ resourceId: '208', amountKamas: 6000, createdAt: old2, kind: 'item' });
    insert({ resourceId: '208', amountKamas: 7000, createdAt: old1, kind: 'item', serverId: 'dakal' });
    insert({ resourceId: '362', amountKamas: 100, createdAt: old1 });
    insert({ resourceId: '362', amountKamas: 110, createdAt: old2 });
    insert({ resourceId: '400', amountKamas: 50, createdAt: recent });

    await expect(purgeExpiredContributions(d1, NOW)).resolves.toBe(3);
    expect(rows().map((row) => [row.resource_id, row.server_id, row.amount_kamas])).toEqual([
      ['208', 'dakal', 7000],
      ['208', 'mikhal', 6000],
      ['400', 'mikhal', 50],
    ]);
  });

  it('removes an old item row once a newer one for the same item and server exists', async () => {
    const { d1, insert, rows } = createTestD1();
    insert({ resourceId: '208', amountKamas: 6000, createdAt: '2026-02-10T10:00:00.000Z', kind: 'item' });
    insert({ resourceId: '208', amountKamas: 6500, createdAt: '2026-09-20T10:00:00.000Z', kind: 'item' });
    await purgeExpiredContributions(d1, NOW);
    expect(rows().map((row) => row.amount_kamas)).toEqual([6500]);
  });
});
