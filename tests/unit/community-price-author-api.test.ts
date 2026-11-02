import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCommunityPrice, getLatestItemPrice, getSharedItemPrices, submitCommunityPrice } from '../../src/services/community-price-api';
import { clearFmSessionToken, writeFmSessionToken } from '../../src/persistence/fm-session-token';

// specs/082-auteur-prix-communautaires: the client signs the price with the session, and reads the author back.
const price = {
  resourceId: 'r1', serverId: 's1', medianAmountKamas: 1200, sampleSize: 4,
  latestAmountKamas: 1100, latestContributionAt: '2026-09-28T13:51:28.940Z',
};
const reply = (body: unknown) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));

beforeEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});
afterEach(() => clearFmSessionToken());

describe('submitCommunityPrice', () => {
  it('sends the session in X-Fm-Session, keeping the app key in Authorization', async () => {
    writeFmSessionToken('s'.repeat(64));
    const fetchMock = reply({ id: 'c1' });
    vi.stubGlobal('fetch', fetchMock);
    await submitCommunityPrice('r1', 's1', 1000);
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers['X-Fm-Session']).toBe('s'.repeat(64));
    expect(headers.Authorization).toMatch(/^Bearer /);
    expect(headers.Authorization).not.toContain('s'.repeat(64));
  });

  it('sends no session header for a visitor', async () => {
    const fetchMock = reply({ id: 'c1' });
    vi.stubGlobal('fetch', fetchMock);
    await submitCommunityPrice('r1', 's1', 1000);
    expect((fetchMock.mock.calls[0][1] as RequestInit).headers).not.toHaveProperty('X-Fm-Session');
  });
});

describe('reading the author', () => {
  it('keeps the pseudonym of the latest resource price', async () => {
    vi.stubGlobal('fetch', reply({ ...price, latestAuthor: 'Cyril' }));
    await expect(getCommunityPrice('r1', 's1')).resolves.toEqual({ status: 'found', price: { ...price, latestAuthor: 'Cyril' } });
  });

  it('drops an author that is not a name', async () => {
    vi.stubGlobal('fetch', reply({ ...price, latestAuthor: 42 }));
    const result = await getCommunityPrice('r1', 's1');
    expect(result.status === 'found' && result.price.latestAuthor).toBeUndefined();
  });

  it('keeps the author of an item price and of the list of item prices', async () => {
    const item = { itemId: 'i1', serverId: 's1', amountKamas: 500, contributedAt: '2026-09-28T13:51:28.940Z', author: 'Cyril' };
    vi.stubGlobal('fetch', reply(item));
    const latest = await getLatestItemPrice('i1', 's1');
    expect(latest.status === 'found' && latest.price.author).toBe('Cyril');
    vi.stubGlobal('fetch', reply({ items: [{ itemId: 'i1', amountKamas: 500, contributedAt: item.contributedAt, author: 'Cyril' }, { itemId: 'i2', amountKamas: 9, contributedAt: item.contributedAt }] }));
    const list = await getSharedItemPrices('s1');
    expect(list.status === 'found' && list.items.map((entry) => entry.author)).toEqual(['Cyril', undefined]);
  });
});
