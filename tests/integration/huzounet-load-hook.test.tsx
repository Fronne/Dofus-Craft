import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { SLICE_SPACING_MS, type RefreshOutcome } from '../../src/domain/huzounet-load';
import type { CommunityPrice } from '../../src/domain/types';
import type { CommunityPricesLookup } from '../../src/services/community-price-api';

// specs/046-hdv-huzounet-load: the loop that loads a tab, with the real rules (requests of 90 items,
// 5.5 s apart) and a pause the test controls.
const getCommunityPrices = vi.fn<(ids: string[], serverId: string) => Promise<CommunityPricesLookup>>();
const refreshExternalPrices = vi.fn<(serverId: string, ids: string[]) => Promise<RefreshOutcome>>();

vi.mock('../../src/services/community-price-api', () => ({
  getCommunityPrices: (ids: string[], serverId: string) => getCommunityPrices(ids, serverId),
  refreshExternalPrices: (serverId: string, ids: string[]) => refreshExternalPrices(serverId, ids),
}));

import { useHuzounetLoad } from '../../src/features/hdv/useHuzounetLoad';
import { resourcePricesFor } from '../../src/persistence/resource-prices-for-mode';

const OBSERVED_AT = '2026-10-12T02:10:00.000Z';
const known = new Map<string, CommunityPrice>();
const huzounetPrice = (id: string, amount: number): CommunityPrice => ({
  resourceId: id, serverId: 'mikhal', medianAmountKamas: 0, sampleSize: 0, latestAmountKamas: amount, latestContributionAt: OBSERVED_AT, latestOrigin: 'external',
});
const refreshedIds = () => refreshExternalPrices.mock.calls.map(([, ids]) => ids);

describe('useHuzounetLoad — pace and retries (specs/046)', () => {
  const ids = Array.from({ length: 128 }, (_, index) => String(index + 1));
  const waits: number[] = [];
  const wait = async (ms: number) => {
    waits.push(ms);
  };
  const mount = (priceMode: 'community' | 'personal' = 'community', serverId = 'mikhal') => {
    const onSliceLoaded = vi.fn();
    const hook = renderHook(() => useHuzounetLoad({ serverId, priceMode, tab: 'consumables', ids, onSliceLoaded, wait }));
    return { ...hook, onSliceLoaded };
  };

  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    known.clear();
    waits.length = 0;
    getCommunityPrices.mockReset();
    getCommunityPrices.mockImplementation(async (asked) => ({ status: 'found', prices: asked.flatMap((id) => known.get(id) ?? []) }));
    refreshExternalPrices.mockReset();
    refreshExternalPrices.mockResolvedValue({ status: 'ok', refreshed: 0 });
  });

  it('waits between two requests, never before the first one', async () => {
    const { result, onSliceLoaded } = mount();
    await act(() => result.current.start());
    expect(result.current.state).toEqual({ status: 'finished', total: 128, loaded: 0 });
    expect(refreshExternalPrices).toHaveBeenCalledTimes(2);
    // One pause: the 5.5 s between two sends, less what the first request took.
    expect(waits).toHaveLength(1);
    expect(waits[0]).toBeGreaterThan(5000);
    expect(waits[0]).toBeLessThanOrEqual(SLICE_SPACING_MS);
    expect(refreshedIds().map((slice) => slice.length)).toEqual([90, 38]);
    expect(onSliceLoaded).toHaveBeenCalledTimes(2);
  });

  it('writes the prices read to the community carnet with their own date, never over a more recent one', async () => {
    await resourcePricesFor('community').save('mikhal', '2', 999, '2026-10-12T10:00:00.000Z');
    known.set('1', huzounetPrice('1', 150));
    known.set('2', huzounetPrice('2', 250));
    refreshExternalPrices.mockResolvedValueOnce({ status: 'ok', refreshed: 2 });
    const { result } = mount();
    await act(() => result.current.start());
    expect(result.current.state).toEqual({ status: 'finished', total: 128, loaded: 2 });
    const carnet = await resourcePricesFor('community').getMany('mikhal', ['1', '2']);
    expect(carnet['1']).toMatchObject({ unitPriceKamas: 150, updatedAt: OBSERVED_AT });
    expect(carnet['2']).toMatchObject({ unitPriceKamas: 999 });
    expect(await resourcePricesFor('personal').getMany('mikhal', ['1', '2'])).toEqual({});
  });

  it('asks again for a request refused as too soon, after a pause, then goes on', async () => {
    refreshExternalPrices.mockResolvedValueOnce({ status: 'too-soon' }).mockResolvedValueOnce({ status: 'ok', refreshed: 3 });
    const { result } = mount();
    await act(() => result.current.start());
    expect(result.current.state).toEqual({ status: 'finished', total: 128, loaded: 3 });
    expect(refreshedIds().map((slice) => slice.length)).toEqual([90, 90, 38]);
    expect(refreshedIds()[1]).toEqual(refreshedIds()[0]);
    expect(waits).toHaveLength(2);
  });

  it('gives up after three retries of the same request', async () => {
    refreshExternalPrices.mockResolvedValue({ status: 'too-soon' });
    const { result } = mount();
    await act(() => result.current.start());
    expect(result.current.state).toEqual({ status: 'failed', done: 0, total: 128, loaded: 0, cause: 'too-soon' });
    expect(refreshExternalPrices).toHaveBeenCalledTimes(4);
  });

  it('stops where Huzounet fails, keeping count of what was loaded before', async () => {
    refreshExternalPrices.mockResolvedValueOnce({ status: 'ok', refreshed: 40 }).mockResolvedValueOnce({ status: 'unavailable' });
    const { result } = mount();
    await act(() => result.current.start());
    expect(result.current.state).toEqual({ status: 'failed', done: 90, total: 128, loaded: 40, cause: 'unavailable' });
  });

  it('stops when the prices just read cannot be read back', async () => {
    getCommunityPrices.mockResolvedValue({ status: 'unavailable' });
    const { result } = mount();
    await act(() => result.current.start());
    expect(result.current.state).toMatchObject({ status: 'failed', cause: 'unreachable' });
    expect(refreshExternalPrices).toHaveBeenCalledTimes(1);
  });

  it('runs one load at a time', async () => {
    const { result } = mount();
    await act(async () => {
      await Promise.all([result.current.start(), result.current.start()]);
    });
    expect(refreshExternalPrices).toHaveBeenCalledTimes(2);
  });

  it('sends nothing in Mode personnel or on a server that is not read', async () => {
    for (const hook of [mount('personal'), mount('community', 'draconiros')]) {
      await act(() => hook.result.current.start());
      expect(hook.result.current.state).toEqual({ status: 'idle' });
    }
    expect(refreshExternalPrices).not.toHaveBeenCalled();
    expect(getCommunityPrices).not.toHaveBeenCalled();
  });

  it('sends no further request once stopped, even during the pause between two', async () => {
    let release: () => void = () => undefined;
    const onSliceLoaded = vi.fn();
    let blocking = true;
    const blockingWait = () => (blocking ? new Promise<void>((resolve) => {
      release = resolve;
    }) : Promise.resolve());
    refreshExternalPrices.mockResolvedValueOnce({ status: 'ok', refreshed: 6 });
    const { result } = renderHook(() => useHuzounetLoad({ serverId: 'mikhal', priceMode: 'community', tab: 'consumables', ids, onSliceLoaded, wait: blockingWait }));
    let running: Promise<void> = Promise.resolve();
    act(() => {
      running = result.current.start();
    });
    await waitFor(() => expect(result.current.state).toEqual({ status: 'running', done: 90, total: 128, loaded: 6 }));
    act(() => result.current.stop());
    expect(result.current.state).toEqual({ status: 'stopped', done: 90, total: 128, loaded: 6 });
    release();
    await act(() => running);
    expect(refreshExternalPrices).toHaveBeenCalledTimes(1);
    expect(result.current.state.status).toBe('stopped');
    // Stopped, it can be started again from the first request.
    blocking = false;
    await act(() => result.current.start());
    expect(refreshedIds().map((slice) => slice.length)).toEqual([90, 90, 38]);
  });

  it('sends nothing more once the page is left', async () => {
    let answer: (outcome: RefreshOutcome) => void = () => undefined;
    refreshExternalPrices.mockImplementationOnce(() => new Promise((resolve) => {
      answer = resolve;
    }));
    const { result, unmount, onSliceLoaded } = mount();
    let running: Promise<void> = Promise.resolve();
    act(() => {
      running = result.current.start();
    });
    await waitFor(() => expect(refreshExternalPrices).toHaveBeenCalledTimes(1));
    unmount();
    answer({ status: 'ok', refreshed: 9 });
    await running;
    expect(refreshExternalPrices).toHaveBeenCalledTimes(1);
    expect(onSliceLoaded).not.toHaveBeenCalled();
  });
});
