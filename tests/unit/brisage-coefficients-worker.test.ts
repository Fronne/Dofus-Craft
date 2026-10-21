import { describe, expect, it } from 'vitest';
import { coefficientsResponse, insertCoefficients, parseCoefficientPayload, purgeExpiredCoefficients } from '../../worker/src/brisage-coefficients';
import { createTestD1 } from '../support/sqlite-d1';

// specs/069-coefficients-brisage-partages.
const NOW = new Date('2026-10-22T12:00:00.000Z');
const url = (query: string) => new URL(`https://api.test/brisage-coefficients?${query}`);
const entry = (over: Record<string, unknown> = {}) => ({ serverId: 'mikhal', itemId: '777', coefficient: 38, ...over });
const payload = (entries: unknown[], deviceId = 'dev-1') => ({ deviceId, entries });

describe('parseCoefficientPayload', () => {
  it('accepts a note without date (dated now) and an import with its original date', () => {
    const parsed = parseCoefficientPayload(payload([entry(), entry({ itemId: '888', coefficient: 12.5, notedAt: '2026-10-21T16:00:00+02:00' })]), NOW);
    expect(parsed?.entries).toEqual([
      { serverId: 'mikhal', itemId: '777', coefficient: 38, notedAt: '2026-10-22T12:00:00.000Z' },
      { serverId: 'mikhal', itemId: '888', coefficient: 12.5, notedAt: '2026-10-21T14:00:00.000Z' },
    ]);
  });

  it.each([
    ['zero coefficient', entry({ coefficient: 0 })],
    ['negative coefficient', entry({ coefficient: -3 })],
    ['coefficient above 4000', entry({ coefficient: 4001 })],
    ['text coefficient', entry({ coefficient: '38' })],
    ['empty server', entry({ serverId: '' })],
    ['missing item', entry({ itemId: undefined })],
    ['invalid date', entry({ notedAt: 'hier' })],
    ['future date', entry({ notedAt: '2026-10-23T12:00:00.000Z' })],
    ['date older than 90 days', entry({ notedAt: '2026-07-01T12:00:00.000Z' })],
  ])('refuses %s', (_label, bad) => {
    expect(parseCoefficientPayload(payload([bad]), NOW)).toBeUndefined();
  });

  it('refuses an empty or too long list, and a missing device', () => {
    expect(parseCoefficientPayload(payload([]), NOW)).toBeUndefined();
    expect(parseCoefficientPayload(payload(Array.from({ length: 101 }, () => entry())), NOW)).toBeUndefined();
    expect(parseCoefficientPayload({ entries: [entry()] }, NOW)).toBeUndefined();
    expect(parseCoefficientPayload('x', NOW)).toBeUndefined();
  });

  it('accepts the maximum coefficient', () => {
    expect(parseCoefficientPayload(payload([entry({ coefficient: 4000 })]), NOW)).toBeDefined();
  });
});

describe('storing and reading coefficients', () => {
  async function seed() {
    const test = createTestD1();
    const send = (entries: unknown[], deviceId = 'secret-device') => insertCoefficients(test.d1, parseCoefficientPayload(payload(entries, deviceId), NOW)!);
    await send([
      entry({ coefficient: 30, notedAt: '2026-10-10T10:00:00.000Z' }),
      entry({ coefficient: 44, notedAt: '2026-10-20T10:00:00.000Z' }),
      entry({ itemId: '888', coefficient: 20, notedAt: '2026-10-15T10:00:00.000Z' }),
      entry({ serverId: 'dakal', coefficient: 99, notedAt: '2026-10-21T10:00:00.000Z' }),
    ]);
    return { ...test, send };
  }

  it('gives the latest coefficient of each requested item on the server, and leaves out items nobody noted', async () => {
    const { d1 } = await seed();
    const { status, body } = await coefficientsResponse(d1, url('serverId=mikhal&itemIds=777,888,999,777'), NOW);
    expect(status).toBe(200);
    expect(body).toEqual({
      serverId: 'mikhal',
      coefficients: [
        { itemId: '777', coefficient: 44, notedAt: '2026-10-20T10:00:00.000Z' },
        { itemId: '888', coefficient: 20, notedAt: '2026-10-15T10:00:00.000Z' },
      ],
    });
  });

  it('never exposes the device that noted a coefficient', async () => {
    const { d1 } = await seed();
    expect(JSON.stringify((await coefficientsResponse(d1, url('serverId=mikhal&itemIds=777,888'), NOW)).body)).not.toContain('secret-device');
  });

  it('ignores a note older than 90 days even before the purge', async () => {
    const { d1, sqlite } = await seed();
    sqlite.prepare("INSERT INTO brisage_coefficients (server_id, item_id, coefficient, noted_at, device_id) VALUES ('mikhal', '555', 10, '2026-06-01T00:00:00.000Z', 'd')").run();
    expect((await coefficientsResponse(d1, url('serverId=mikhal&itemIds=555'), NOW)).body).toEqual({ serverId: 'mikhal', coefficients: [] });
  });

  it('does not duplicate a note sent twice (retried import)', async () => {
    const { send, sqlite } = await seed();
    await send([entry({ coefficient: 44, notedAt: '2026-10-20T10:00:00.000Z' })]);
    expect(Number((sqlite.prepare('SELECT COUNT(*) AS n FROM brisage_coefficients').get() as { n: number }).n)).toBe(4);
  });

  it('refuses a request without server or items, or with too many', async () => {
    const { d1 } = await seed();
    expect((await coefficientsResponse(d1, url('itemIds=1'), NOW)).status).toBe(400);
    expect((await coefficientsResponse(d1, url('serverId=mikhal'), NOW)).status).toBe(400);
    const many = Array.from({ length: 97 }, (_, i) => i + 1).join(',');
    expect((await coefficientsResponse(d1, url(`serverId=mikhal&itemIds=${many}`), NOW)).status).toBe(400);
  });

  it('reads a full batch of items in one query (D1 allows 100 parameters)', async () => {
    const { d1 } = await seed();
    const ids = Array.from({ length: 96 }, (_, i) => String(700 + i)).join(',');
    expect((await coefficientsResponse(d1, url(`serverId=mikhal&itemIds=${ids}`), NOW)).status).toBe(200);
  });

  it('purges only the notes older than 90 days', async () => {
    const { d1, sqlite } = await seed();
    sqlite.prepare("INSERT INTO brisage_coefficients (server_id, item_id, coefficient, noted_at, device_id) VALUES ('mikhal', '1', 10, '2026-07-20T00:00:00.000Z', 'd'), ('mikhal', '2', 10, '2026-07-25T00:00:00.000Z', 'd')").run();
    // cutoff = 2026-07-24T12:00:00Z
    await expect(purgeExpiredCoefficients(d1, NOW)).resolves.toBe(1);
    expect(Number((sqlite.prepare('SELECT COUNT(*) AS n FROM brisage_coefficients').get() as { n: number }).n)).toBe(5);
  });
});
