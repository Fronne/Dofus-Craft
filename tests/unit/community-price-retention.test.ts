import { describe, expect, it } from 'vitest';
import { purgeExpiredContributions, retentionCutoff } from '../../worker/src/retention';

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
      sql: 'DELETE FROM community_price_contributions WHERE created_at < ?',
      params: ['2026-06-25T12:00:00.000Z'],
    }]);
  });
});
