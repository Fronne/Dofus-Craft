import { describe, expect, it } from 'vitest';
import { coefficientsResponse, insertClears, insertCoefficients, parseClearPayload, parseCoefficientPayload, purgeExpiredCoefficients } from '../../worker/src/brisage-coefficients';
import { createTestD1 } from '../support/sqlite-d1';

// specs/069-coefficients-brisage-partages: « coefficient unknown » (the clear of an item).
const NOW = new Date('2026-10-22T12:00:00.000Z');
const url = (query: string) => new URL(`https://api.test/brisage-coefficients?${query}`);
const entry = (over: Record<string, unknown> = {}) => ({ serverId: 'mikhal', itemId: '777', coefficient: 38, ...over });
const payload = (entries: unknown[], deviceId = 'dev-1') => ({ deviceId, entries });
const clear = { deviceId: 'dev-1', entries: [{ serverId: 'mikhal', itemId: '777' }] };

describe('parseClearPayload', () => {
  it('accepts entries without a date and refuses a malformed request', () => {
    expect(parseClearPayload(clear)).toEqual(clear);
    expect(parseClearPayload({ deviceId: '', entries: clear.entries })).toBeUndefined();
    expect(parseClearPayload({ deviceId: 'dev-1', entries: [] })).toBeUndefined();
    expect(parseClearPayload({ deviceId: 'dev-1', entries: [{ serverId: 'mikhal' }] })).toBeUndefined();
    expect(parseClearPayload('x')).toBeUndefined();
  });
});

describe('clearing a coefficient', () => {
  it('hides the notes made before the clear, keeps the ones made after, and touches no other item', async () => {
    const { d1 } = createTestD1();
    await insertCoefficients(d1, parseCoefficientPayload(payload([
      entry({ coefficient: 44, notedAt: '2026-10-20T10:00:00.000Z' }),
      entry({ itemId: '888', coefficient: 20, notedAt: '2026-10-15T10:00:00.000Z' }),
    ]), NOW)!);
    await insertClears(d1, parseClearPayload(clear)!, new Date('2026-10-21T10:00:00.000Z'));
    const read = async () => (await coefficientsResponse(d1, url('serverId=mikhal&itemIds=777,888'), NOW)).body as { coefficients: { itemId: string; coefficient: number }[] };
    expect((await read()).coefficients.map((row) => [row.itemId, row.coefficient])).toEqual([['888', 20]]);
    await insertCoefficients(d1, parseCoefficientPayload(payload([entry({ coefficient: 55, notedAt: '2026-10-22T09:00:00.000Z' })]), NOW)!);
    expect((await read()).coefficients.map((row) => [row.itemId, row.coefficient])).toEqual([['777', 55], ['888', 20]]);
  });

  it('does not hide the coefficient of another server', async () => {
    const { d1 } = createTestD1();
    await insertCoefficients(d1, parseCoefficientPayload(payload([entry({ serverId: 'dakal', coefficient: 44, notedAt: '2026-10-20T10:00:00.000Z' })]), NOW)!);
    await insertClears(d1, parseClearPayload(clear)!, new Date('2026-10-21T10:00:00.000Z'));
    const body = (await coefficientsResponse(d1, url('serverId=dakal&itemIds=777'), NOW)).body as { coefficients: unknown[] };
    expect(body.coefficients).toHaveLength(1);
  });

  it('purges the clears older than the retention with the coefficients', async () => {
    const { d1 } = createTestD1();
    await insertClears(d1, parseClearPayload(clear)!, new Date('2026-06-01T00:00:00.000Z'));
    await purgeExpiredCoefficients(d1, NOW);
    const { results } = await d1.prepare('SELECT COUNT(*) AS n FROM brisage_coefficient_clears').bind().all<{ n: number }>();
    expect(results[0].n).toBe(0);
  });
});
