import { describe, expect, it } from 'vitest';
import { priceHistoryResponse } from '../../worker/src/price-history';
import { createTestD1 } from '../support/sqlite-d1';

// specs/018-price-history-windows, contracts/price-history-api.md.
const NOW = new Date('2026-09-25T12:00:00.000Z');
const url = (query: string) => new URL(`https://api.test/price-history?${query}`);

describe('GET /price-history (specs/018)', () => {
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
    expect(resource.body).toMatchObject({ week: [{ amountKamas: 1000 }] });
    expect(item.body).toMatchObject({ week: [{ amountKamas: 6000 }] });
  });

  it('ignores another server', async () => {
    const { d1, insert } = createTestD1();
    insert({ resourceId: '208', serverId: 'dakal', amountKamas: 1000, createdAt: '2026-09-21T10:00:00.000Z' });
    await expect(priceHistoryResponse(d1, url('kind=resource&id=208&serverId=mikhal'), NOW)).resolves.toMatchObject({
      body: { day: [], week: [], month: [] },
    });
  });

  it('excludes a price older than 30 days', async () => {
    const { d1, insert } = createTestD1();
    insert({ resourceId: '208', amountKamas: 6000, createdAt: '2026-08-25T11:59:00.000Z', kind: 'item' });
    await expect(priceHistoryResponse(d1, url('kind=item&id=208&serverId=mikhal'), NOW)).resolves.toMatchObject({
      body: { day: [], week: [], month: [] },
    });
  });

  it('never exposes a device id, only the amount and the time to the minute (FR-006)', async () => {
    const { d1, insert } = createTestD1();
    insert({ resourceId: '208', amountKamas: 1000, createdAt: '2026-09-21T10:00:42.000Z', deviceId: 'device-secret' });
    const { status, body } = await priceHistoryResponse(d1, url('kind=resource&id=208&serverId=mikhal'), NOW);
    expect(status).toBe(200);
    expect(JSON.stringify(body)).not.toMatch(/device|createdAt|created_at/);
    expect(body).toEqual({
      day: [],
      week: [{ amountKamas: 1000, sharedAt: '2026-09-21T10:00:00.000Z' }],
      month: [{ amountKamas: 1000, sharedAt: '2026-09-21T10:00:00.000Z' }],
    });
  });
});
