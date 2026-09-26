import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getPriceHistory } from '../../src/services/community-price-api';

// specs/018-price-history-windows, contracts/price-history-api.md « Client ».
const PRICE = { amountKamas: 1000, sharedAt: '2026-09-21T10:00:00.000Z' };
const HISTORY = { day: [PRICE], week: [PRICE], month: [PRICE] };

describe('getPriceHistory (specs/018)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('resolves the history and calls /price-history with kind, id and serverId', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(HISTORY), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getPriceHistory('item', '208', 'mikhal')).resolves.toEqual({ status: 'found', history: HISTORY });
    expect(String(fetchMock.mock.calls[0][0])).toContain('/price-history?kind=item&id=208&serverId=mikhal');
  });

  it('resolves found with empty lists when nothing was shared yet', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ day: [], week: [], month: [] }), { status: 200 })));
    await expect(getPriceHistory('resource', 'r1', 'mikhal')).resolves.toEqual({
      status: 'found', history: { day: [], week: [], month: [] },
    });
  });

  it.each([
    ['a 500 status', () => Promise.resolve(new Response('', { status: 500 }))],
    ['a network error', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['invalid JSON', () => Promise.resolve(new Response('not json', { status: 200 }))],
    ['a missing window', () => Promise.resolve(new Response(JSON.stringify({ day: [], week: [] }), { status: 200 }))],
    ['a price without its time', () => Promise.resolve(new Response(JSON.stringify({
      ...HISTORY, week: [{ amountKamas: 1000 }],
    }), { status: 200 }))],
    ['the specs/017 format', () => Promise.resolve(new Response(JSON.stringify({
      day: [], week: [{ periodStart: '2026-09-21', medianAmountKamas: 1000, sampleSize: 2 }], month: [],
    }), { status: 200 }))],
  ])('resolves unavailable, without throwing, on %s', async (_label, response) => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(response));
    await expect(getPriceHistory('resource', 'r1', 'mikhal')).resolves.toEqual({ status: 'unavailable' });
  });
});
