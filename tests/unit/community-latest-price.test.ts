import { describe, expect, it } from 'vitest';
import { latestPriceResponse, readLatestContribution } from '../../worker/src/latest';
import { insertContribution, parseContributionPayload } from '../../worker/src/contribution';
import { createTestD1 } from '../support/sqlite-d1';

describe('readLatestContribution (specs/016 contracts/community-api.md)', () => {
  it('returns the most recent item contribution for the item and server', async () => {
    const { d1, insert } = createTestD1();
    insert({ resourceId: '208', amountKamas: 5000, createdAt: '2026-09-20T10:00:00.000Z', kind: 'item' });
    insert({ resourceId: '208', amountKamas: 6000, createdAt: '2026-09-24T10:00:00.000Z', kind: 'item' });
    insert({ resourceId: '208', amountKamas: 9999, createdAt: '2026-09-25T10:00:00.000Z', kind: 'item', serverId: 'dakal' });
    await expect(readLatestContribution(d1, '208', 'mikhal')).resolves.toEqual({
      amountKamas: 6000, contributedAt: '2026-09-24T10:00:00.000Z',
    });
  });

  it('ignores resource rows under the same identifier', async () => {
    const { d1, insert } = createTestD1();
    insert({ resourceId: '208', amountKamas: 6000, createdAt: '2026-09-24T10:00:00.000Z', kind: 'item' });
    insert({ resourceId: '208', amountKamas: 1, createdAt: '2026-09-25T10:00:00.000Z', kind: 'resource' });
    await expect(readLatestContribution(d1, '208', 'mikhal')).resolves.toMatchObject({ amountKamas: 6000 });
  });

  it('returns undefined when nothing was shared', async () => {
    const { d1 } = createTestD1();
    await expect(readLatestContribution(d1, '208', 'mikhal')).resolves.toBeUndefined();
  });

  it('still reads a contribution older than 90 days (no age limit)', async () => {
    const { d1, insert } = createTestD1();
    insert({ resourceId: '208', amountKamas: 4200, createdAt: '2025-01-01T10:00:00.000Z', kind: 'item' });
    await expect(readLatestContribution(d1, '208', 'mikhal')).resolves.toMatchObject({ amountKamas: 4200 });
  });
});

describe('GET /latest-price (specs/016)', () => {
  const call = (d1: Parameters<typeof latestPriceResponse>[0], query: string) =>
    latestPriceResponse(d1, new URL(`https://api.test/latest-price${query}`));

  it('returns the latest item price with its date', async () => {
    const { d1, insert } = createTestD1();
    insert({ resourceId: '208', amountKamas: 6000, createdAt: '2026-09-24T10:00:00.000Z', kind: 'item' });
    const response = await call(d1, '?itemId=208&serverId=mikhal');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      itemId: '208', serverId: 'mikhal', amountKamas: 6000, contributedAt: '2026-09-24T10:00:00.000Z',
    });
  });

  it('answers 404 with null when nothing was shared', async () => {
    const { d1 } = createTestD1();
    const response = await call(d1, '?itemId=208&serverId=mikhal');
    expect(response.status).toBe(404);
    expect(response.body).toBeNull();
  });

  it('answers 400 when a parameter is missing', async () => {
    const { d1 } = createTestD1();
    expect((await call(d1, '?itemId=208')).status).toBe(400);
    expect((await call(d1, '?serverId=mikhal')).status).toBe(400);
  });
});

describe('POST /community-price with kind (specs/016)', () => {
  const base = { resourceId: '208', serverId: 'mikhal', amountKamas: 9000, deviceId: 'device-b' };

  it('accepts kind "item" or no kind, and rejects any other kind', () => {
    expect(parseContributionPayload({ ...base, kind: 'item' })).toMatchObject({ kind: 'item' });
    expect(parseContributionPayload(base)).toMatchObject({ kind: 'resource' });
    expect(parseContributionPayload({ ...base, kind: 'weapon' })).toBeUndefined();
  });

  it('stores an item price as such and traces its deviation from the latest item price', async () => {
    const { d1, insert, rows } = createTestD1();
    insert({ resourceId: '208', amountKamas: 6000, createdAt: '2026-09-24T10:00:00.000Z', kind: 'item' });
    await insertContribution(d1, parseContributionPayload({ ...base, kind: 'item' })!);
    const added = rows().at(-1)!;
    expect(added).toMatchObject({ kind: 'item', amount_kamas: 9000, median_at_submission_kamas: 6000, deviation_percent: 50 });
  });

  it('leaves the trace empty for a first item price', async () => {
    const { d1, rows } = createTestD1();
    await insertContribution(d1, parseContributionPayload({ ...base, kind: 'item' })!);
    expect(rows().at(-1)).toMatchObject({ kind: 'item', median_at_submission_kamas: null, deviation_percent: null });
  });

  it('still traces a resource price against the community median', async () => {
    const { d1, insert, rows } = createTestD1();
    const recent = new Date(Date.now() - 60_000).toISOString();
    insert({ resourceId: '362', amountKamas: 100, createdAt: recent, deviceId: 'd1' });
    insert({ resourceId: '362', amountKamas: 100, createdAt: recent, deviceId: 'd2' });
    insert({ resourceId: '362', amountKamas: 100, createdAt: recent, deviceId: 'd3' });
    await insertContribution(d1, parseContributionPayload({ ...base, resourceId: '362', amountKamas: 150 })!);
    expect(rows().at(-1)).toMatchObject({ kind: 'resource', median_at_submission_kamas: 100, deviation_percent: 50 });
  });
});
