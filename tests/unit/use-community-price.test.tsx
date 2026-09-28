import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCommunityPrice, type CommunityPriceState } from '../../src/features/comparison/useCommunityPrice';

const getCommunityPrice = vi.fn();
vi.mock('../../src/services/community-price-api', () => ({
  getCommunityPrice: (...args: unknown[]) => getCommunityPrice(...args),
  getCommunityPrices: async (ids: string[], serverId: string) => {
    const results = await Promise.all(ids.map((id) => getCommunityPrice(id, serverId) as Promise<{ status: string; price?: unknown }>));
    if (results.some((result) => !result || result.status === 'unavailable')) return { status: 'unavailable' };
    return { status: 'found', prices: results.flatMap((result) => (result.status === 'found' ? [result.price] : [])) };
  },
  submitCommunityPrice: vi.fn(),
}));

// This project has no `renderHook` precedent (see tests/integration/pinned-item-collections.test.tsx):
// hooks are exercised through a small harness component instead.
function Harness({ resourceId, serverId, onState }: { resourceId: string; serverId: string; onState: (state: CommunityPriceState) => void }) {
  const [state] = useCommunityPrice(resourceId, serverId);
  onState(state);
  return null;
}

function cacheKey(resourceId: string, serverId: string) {
  return `craftcheck-community-price:${serverId}:${resourceId}`;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useCommunityPrice (specs/010-search-instant-cache, T016)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    getCommunityPrice.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  const LATEST = { latestAmountKamas: 900, latestContributionAt: '2026-09-27T10:00:00.000Z' };
  const cached = { medianAmountKamas: 1000, sampleSize: 4, ...LATEST };
  const cachedPrice = { resourceId: 'resource-1', serverId: 'mikhal', medianAmountKamas: 1000, sampleSize: 4, lastContributionAt: undefined, ...LATEST };

  it('applies a cached value immediately at mount, before the network resolves (FR-001)', async () => {
    window.localStorage.setItem(cacheKey('resource-1', 'mikhal'), JSON.stringify(cached));
    let resolveNetwork!: (value: { status: 'not-found' }) => void;
    getCommunityPrice.mockReturnValue(new Promise((resolve) => { resolveNetwork = resolve; }));

    const states: CommunityPriceState[] = [];
    render(<Harness resourceId="resource-1" serverId="mikhal" onState={(state) => states.push(state)} />);
    await flush();

    expect(states.at(-1)).toEqual({ kind: 'found', price: cachedPrice, stale: true });

    // Cleans up the still-pending mock so it doesn't dangle into another test.
    resolveNetwork({ status: 'not-found' });
    await flush();
  });

  it('ignores a cached entry saved before the latest price existed (specs/024)', async () => {
    window.localStorage.setItem(cacheKey('resource-1', 'mikhal'), JSON.stringify({ medianAmountKamas: 1000, sampleSize: 4 }));
    getCommunityPrice.mockResolvedValue({ status: 'unavailable' });

    const states: CommunityPriceState[] = [];
    render(<Harness resourceId="resource-1" serverId="mikhal" onState={(state) => states.push(state)} />);
    await flush();
    await flush();

    expect(states[0]).toEqual({ kind: 'loading' });
    expect(states.at(-1)).toEqual({ kind: 'unavailable' });
  });

  it('starts at loading (not found) when nothing is cached yet (FR-006)', async () => {
    getCommunityPrice.mockReturnValue(new Promise(() => undefined));
    const states: CommunityPriceState[] = [];
    render(<Harness resourceId="resource-1" serverId="mikhal" onState={(state) => states.push(state)} />);
    await flush();
    expect(states.at(-1)).toEqual({ kind: 'loading' });
  });

  it('falls back to the cached value (marked stale) when the network call fails, never surfacing a blocking state (FR-007)', async () => {
    window.localStorage.setItem(cacheKey('resource-1', 'mikhal'), JSON.stringify(cached));
    // Matches getCommunityPrice's actual contract (community-price-api.ts): a network failure
    // never rejects the promise, it resolves to `{ status: 'unavailable' }`.
    getCommunityPrice.mockResolvedValue({ status: 'unavailable' });

    const states: CommunityPriceState[] = [];
    render(<Harness resourceId="resource-1" serverId="mikhal" onState={(state) => states.push(state)} />);
    await flush();
    await flush();

    expect(states.at(-1)).toEqual({ kind: 'found', price: cachedPrice, stale: true });
  });

  it('replaces the stale cached value with the fresh one, and caches its latest price (specs/024)', async () => {
    window.localStorage.setItem(cacheKey('resource-1', 'mikhal'), JSON.stringify(cached));
    const fresh = {
      resourceId: 'resource-1', serverId: 'mikhal', medianAmountKamas: 1200, sampleSize: 6,
      latestAmountKamas: 1300, latestContributionAt: '2026-09-28T13:51:28.940Z',
    };
    getCommunityPrice.mockResolvedValue({ status: 'found', price: fresh });

    const states: CommunityPriceState[] = [];
    render(<Harness resourceId="resource-1" serverId="mikhal" onState={(state) => states.push(state)} />);
    await flush();
    await flush();

    expect(states.at(-1)).toEqual({ kind: 'found', price: fresh, stale: false });
    expect(JSON.parse(window.localStorage.getItem(cacheKey('resource-1', 'mikhal'))!)).toMatchObject({
      latestAmountKamas: 1300, latestContributionAt: '2026-09-28T13:51:28.940Z',
    });
  });
});
