import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSharedItemPrices } from '../../src/services/community-price-api';

// specs/019-craft-profit-list, contracts/item-prices-api.md « Client ».
const ITEMS = [{ itemId: '44', amountKamas: 1200, contributedAt: '2026-09-24T10:00:00.000Z' }];

describe('getSharedItemPrices (specs/019)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('resolves the items and calls /item-prices with the server', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ items: ITEMS }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(getSharedItemPrices('mikhal')).resolves.toEqual({ status: 'found', items: ITEMS });
    expect(String(fetchMock.mock.calls[0][0])).toContain('/item-prices?serverId=mikhal');
  });

  it.each([
    ['a 500 status', () => Promise.resolve(new Response('', { status: 500 }))],
    ['a network error', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['invalid JSON', () => Promise.resolve(new Response('not json', { status: 200 }))],
    ['an entry without its amount', () => Promise.resolve(new Response(JSON.stringify({ items: [{ itemId: '44', contributedAt: 'x' }] }), { status: 200 }))],
    ['an entry without its date', () => Promise.resolve(new Response(JSON.stringify({ items: [{ itemId: '44', amountKamas: 1 }] }), { status: 200 }))],
  ])('resolves unavailable, without throwing, on %s', async (_label, response) => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(response));
    await expect(getSharedItemPrices('mikhal')).resolves.toEqual({ status: 'unavailable' });
  });
});
