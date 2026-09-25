import { describe, expect, it } from 'vitest';
import { priceHistoryResponse } from '../../worker/src/price-history';
import { createTestD1 } from '../support/sqlite-d1';

// specs/017-price-history-chart, contracts/price-history-api.md.
const NOW = new Date('2026-09-25T12:00:00.000Z');
const url = (query: string) => new URL(`https://api.test/price-history?${query}`);

describe('GET /price-history (specs/017)', () => {
  it.each([
    'id=208&serverId=mikhal',
    'kind=resource&serverId=mikhal',
    'kind=resource&id=208',
    'kind=equipment&id=208&serverId=mikhal',
  ])('answers 400 on missing or invalid parameters (%s)', async (query) => {
    const { d1 } = createTestD1();
    await expect(priceHistoryResponse(d1, url(query), NOW)).resolves.toEqual({
      status: 400,
      body: { error: 'kind (resource or item), id and serverId are required' },
    });
  });

  it('answers 200 with three empty lists without data', async () => {
    const { d1 } = createTestD1();
    await expect(priceHistoryResponse(d1, url('kind=resource&id=208&serverId=mikhal'), NOW)).resolves.toEqual({
      status: 200,
      body: { day: [], week: [], month: [] },
    });
  });

  it('keeps resource and item rows of the same identifier apart', async () => {
    const { d1, insert } = createTestD1();
    insert({ resourceId: '208', amountKamas: 1000, createdAt: '2026-09-21T10:00:00.000Z', kind: 'resource' });
    insert({ resourceId: '208', amountKamas: 6000, createdAt: '2026-09-21T10:00:00.000Z', kind: 'item' });
    const resource = await priceHistoryResponse(d1, url('kind=resource&id=208&serverId=mikhal'), NOW);
    const item = await priceHistoryResponse(d1, url('kind=item&id=208&serverId=mikhal'), NOW);
    expect(resource.body).toMatchObject({ day: [{ medianAmountKamas: 1000 }] });
    expect(item.body).toMatchObject({ day: [{ medianAmountKamas: 6000 }] });
  });

  it('ignores another server', async () => {
    const { d1, insert } = createTestD1();
    insert({ resourceId: '208', serverId: 'dakal', amountKamas: 1000, createdAt: '2026-09-21T10:00:00.000Z' });
    await expect(priceHistoryResponse(d1, url('kind=resource&id=208&serverId=mikhal'), NOW)).resolves.toMatchObject({
      body: { day: [], week: [], month: [] },
    });
  });

  it("excludes an item's latest price older than 90 days, even though /latest-price keeps it", async () => {
    const { d1, insert } = createTestD1();
    insert({ resourceId: '208', amountKamas: 6000, createdAt: '2026-05-01T10:00:00.000Z', kind: 'item' });
    await expect(priceHistoryResponse(d1, url('kind=item&id=208&serverId=mikhal'), NOW)).resolves.toMatchObject({
      body: { day: [], week: [], month: [] },
    });
  });

  it('never exposes a device id or an individual timestamp (FR-006)', async () => {
    const { d1, insert } = createTestD1();
    insert({ resourceId: '208', amountKamas: 1000, createdAt: '2026-09-21T10:00:00.000Z', deviceId: 'device-secret' });
    const { status, body } = await priceHistoryResponse(d1, url('kind=resource&id=208&serverId=mikhal'), NOW);
    expect(status).toBe(200);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/device|createdAt|created_at|2026-09-21T10/);
    expect(body).toEqual({
      day: [{ periodStart: '2026-09-21', medianAmountKamas: 1000, sampleSize: 1 }],
      week: [{ periodStart: '2026-09-21', medianAmountKamas: 1000, sampleSize: 1 }],
      month: [{ periodStart: '2026-09-01', medianAmountKamas: 1000, sampleSize: 1 }],
    });
  });
});
