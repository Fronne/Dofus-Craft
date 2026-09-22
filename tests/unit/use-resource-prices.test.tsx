import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useResourcePrices } from '../../src/features/comparison/useResourcePrices';
import type { ResourcePrice, ServerId } from '../../src/domain/types';
import type { ResourcePriceRepository } from '../../src/persistence/resource-price-repository';

// This project has no `renderHook` precedent (see tests/integration/pinned-item-collections.test.tsx):
// hooks are exercised through a small harness component instead.
function Harness({
  serverId,
  ids,
  repository,
  onState,
}: {
  serverId: ServerId | undefined;
  ids: string[];
  repository: ResourcePriceRepository;
  onState: (state: ReturnType<typeof useResourcePrices>) => void;
}) {
  const state = useResourcePrices(serverId, ids, repository);
  onState(state);
  return null;
}

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function fakeRepository(getMany: (serverId: string, ids: string[]) => Promise<Record<string, ResourcePrice>>): ResourcePriceRepository {
  return {
    get: async () => undefined,
    getMany,
    save: async (_serverId, resourceId, unitPriceKamas) => ({ resourceId, unitPriceKamas, updatedAt: new Date().toISOString() }),
    remove: async () => undefined,
    listAllForServer: async () => [],
  };
}

describe('useResourcePrices', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('never lets a slower resolution for an old ids set overwrite a newer one (anti-race, specs/010)', async () => {
    const oldCall = deferred<Record<string, ResourcePrice>>();
    const newCall = deferred<Record<string, ResourcePrice>>();
    const calls: Array<{ ids: string[] }> = [];
    const repository = fakeRepository((_serverId, ids) => {
      calls.push({ ids: [...ids] });
      return ids.join(',') === 'old-resource' ? oldCall.promise : newCall.promise;
    });

    const states: Array<ReturnType<typeof useResourcePrices>> = [];
    const { rerender } = render(
      <Harness serverId="mikhal" ids={['old-resource']} repository={repository} onState={(state) => states.push(state)} />,
    );
    await flush();

    rerender(
      <Harness serverId="mikhal" ids={['new-resource']} repository={repository} onState={(state) => states.push(state)} />,
    );
    await flush();

    // The newer request settles first; the older, now-stale one settles after it.
    await act(async () => {
      newCall.resolve({ 'new-resource': { resourceId: 'new-resource', unitPriceKamas: 200, updatedAt: '2026-01-01T00:00:00.000Z' } });
      await newCall.promise;
    });
    await flush();
    expect(states.at(-1)!.data).toEqual({
      'new-resource': { resourceId: 'new-resource', unitPriceKamas: 200, updatedAt: '2026-01-01T00:00:00.000Z' },
    });

    await act(async () => {
      oldCall.resolve({ 'old-resource': { resourceId: 'old-resource', unitPriceKamas: 100, updatedAt: '2026-01-01T00:00:00.000Z' } });
      await oldCall.promise;
    });
    await flush();
    // The stale "old-resource" result must never appear — the display must still reflect only
    // the current ids set.
    expect(states.at(-1)!.data).toEqual({
      'new-resource': { resourceId: 'new-resource', unitPriceKamas: 200, updatedAt: '2026-01-01T00:00:00.000Z' },
    });
  });

  it('starts loaded=false and only flips to true once the current ids set has actually resolved (FR-006 of specs/004)', async () => {
    const call = deferred<Record<string, ResourcePrice>>();
    const repository = fakeRepository(() => call.promise);
    const states: Array<ReturnType<typeof useResourcePrices>> = [];
    render(<Harness serverId="mikhal" ids={['resource-1']} repository={repository} onState={(state) => states.push(state)} />);
    await flush();
    expect(states.at(-1)!.loaded).toBe(false);

    await act(async () => {
      call.resolve({});
      await call.promise;
    });
    await flush();
    expect(states.at(-1)!.loaded).toBe(true);
  });

  it('does not flash back to an empty data set while a same-ids reload is in flight', async () => {
    const firstCall = deferred<Record<string, ResourcePrice>>();
    const price: ResourcePrice = { resourceId: 'resource-1', unitPriceKamas: 100, updatedAt: '2026-01-01T00:00:00.000Z' };
    const repository = fakeRepository(() => firstCall.promise);
    const states: Array<ReturnType<typeof useResourcePrices>> = [];
    render(<Harness serverId="mikhal" ids={['resource-1']} repository={repository} onState={(state) => states.push(state)} />);
    await flush();

    await act(async () => {
      firstCall.resolve({ 'resource-1': price });
      await firstCall.promise;
    });
    await flush();
    expect(states.at(-1)!.data).toEqual({ 'resource-1': price });
  });
});
