import { act, render } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useStaleWhileRevalidate, type StaleWhileRevalidateState } from '../../src/data/use-stale-while-revalidate';

// This project has no `renderHook` precedent (see tests/integration/pinned-item-collections.test.tsx):
// hooks are exercised through a small harness component instead.
function Harness<T>({
  swrKey,
  loadCached,
  fetchRemote,
  saveCache,
  onState,
  revalidateToken,
}: {
  swrKey: string | undefined;
  loadCached: (key: string) => Promise<{ value: T; savedAt: string } | undefined>;
  fetchRemote: (key: string) => Promise<T>;
  saveCache: (key: string, value: T) => Promise<string>;
  onState: (state: StaleWhileRevalidateState<T>) => void;
  revalidateToken?: string | number;
}) {
  const state = useStaleWhileRevalidate({ key: swrKey, loadCached, fetchRemote, saveCache, revalidateToken });
  onState(state);
  return null;
}

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; reject: (reason: unknown) => void };

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useStaleWhileRevalidate', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('starts loading and shows nothing until the network resolves when there is no cache (FR-006)', async () => {
    const network = deferred<string[]>();
    const states: StaleWhileRevalidateState<string[]>[] = [];
    render(
      <Harness
        swrKey="k1"
        loadCached={() => Promise.resolve(undefined)}
        fetchRemote={() => network.promise}
        saveCache={() => Promise.resolve(new Date().toISOString())}
        onState={(state) => states.push(state)}
      />,
    );
    await flush();
    expect(states.at(-1)).toMatchObject({ data: undefined, loading: true });

    await act(async () => {
      network.resolve(['a']);
      await network.promise;
    });
    await flush();
    expect(states.at(-1)).toMatchObject({ data: ['a'], loading: false, isRevalidating: false });
  });

  it('never lets a cache read overwrite a network response already applied for the same key (FR-010)', async () => {
    const cache = deferred<{ value: string[]; savedAt: string }>();
    const network = deferred<string[]>();
    const states: StaleWhileRevalidateState<string[]>[] = [];
    render(
      <Harness
        swrKey="k1"
        loadCached={() => cache.promise}
        fetchRemote={() => network.promise}
        saveCache={() => Promise.resolve(new Date().toISOString())}
        onState={(state) => states.push(state)}
      />,
    );
    await flush();

    // Network resolves first (unusually fast), then the slower cache read resolves after it.
    await act(async () => {
      network.resolve(['from-network']);
      await network.promise;
    });
    await flush();
    expect(states.at(-1)).toMatchObject({ data: ['from-network'] });

    await act(async () => {
      cache.resolve({ value: ['from-cache'], savedAt: '2026-01-01T00:00:00.000Z' });
      await cache.promise;
    });
    await flush();
    expect(states.at(-1)).toMatchObject({ data: ['from-network'] });
  });

  it('ignores a resolution that arrives for a key the caller has already moved away from (FR-009)', async () => {
    const firstNetwork = deferred<string[]>();
    const secondNetwork = deferred<string[]>();
    const fetchers: Record<string, () => Promise<string[]>> = {
      first: () => firstNetwork.promise,
      second: () => secondNetwork.promise,
    };
    const states: StaleWhileRevalidateState<string[]>[] = [];
    const { rerender } = render(
      <Harness
        swrKey="first"
        loadCached={() => Promise.resolve(undefined)}
        fetchRemote={(key) => fetchers[key]()}
        saveCache={() => Promise.resolve(new Date().toISOString())}
        onState={(state) => states.push(state)}
      />,
    );
    await flush();

    rerender(
      <Harness
        swrKey="second"
        loadCached={() => Promise.resolve(undefined)}
        fetchRemote={(key) => fetchers[key]()}
        saveCache={() => Promise.resolve(new Date().toISOString())}
        onState={(state) => states.push(state)}
      />,
    );
    await flush();

    await act(async () => {
      secondNetwork.resolve(['second-result']);
      await secondNetwork.promise;
    });
    await flush();
    expect(states.at(-1)).toMatchObject({ data: ['second-result'] });

    // The stale "first" request finally resolves, after "second" already applied its result.
    await act(async () => {
      firstNetwork.resolve(['first-result-too-late']);
      await firstNetwork.promise;
    });
    await flush();
    expect(states.at(-1)).toMatchObject({ data: ['second-result'] });
  });

  it('does not produce a new data reference when the network result is unchanged (FR-004)', async () => {
    const cachedValue = ['same'];
    const network = deferred<string[]>();
    const states: StaleWhileRevalidateState<string[]>[] = [];
    render(
      <Harness
        swrKey="k1"
        loadCached={() => Promise.resolve({ value: cachedValue, savedAt: '2026-01-01T00:00:00.000Z' })}
        fetchRemote={() => network.promise}
        saveCache={() => Promise.resolve(new Date().toISOString())}
        onState={(state) => states.push(state)}
      />,
    );
    // Let the (faster) local cache read apply first, as it always does in practice.
    await flush();
    expect(states.at(-1)).toMatchObject({ data: cachedValue });

    await act(async () => {
      network.resolve(['same']);
      await network.promise;
    });
    await flush();

    const finalState = states.at(-1)!;
    expect(finalState.data).toBe(cachedValue);
    expect(finalState.isRevalidating).toBe(false);
  });

  it('keeps showing cached data and marks offline when the network call fails (FR-007)', async () => {
    const network = deferred<string[]>();
    const states: StaleWhileRevalidateState<string[]>[] = [];
    render(
      <Harness
        swrKey="k1"
        loadCached={() => Promise.resolve({ value: ['cached'], savedAt: '2026-01-01T00:00:00.000Z' })}
        fetchRemote={() => network.promise}
        saveCache={() => Promise.resolve(new Date().toISOString())}
        onState={(state) => states.push(state)}
      />,
    );
    await flush();
    expect(states.at(-1)).toMatchObject({ data: ['cached'] });

    await act(async () => {
      network.reject(new Error('network down'));
      await network.promise.catch(() => undefined);
    });
    await flush();

    const finalState = states.at(-1)!;
    expect(finalState.data).toEqual(['cached']);
    expect(finalState.offline).toBe(true);
    expect(finalState.loading).toBe(false);
  });

  it('still shows the cached data (marked offline) even if the network fails before the slower cache read resolves', async () => {
    const cache = deferred<{ value: string[]; savedAt: string }>();
    const states: StaleWhileRevalidateState<string[]>[] = [];
    render(
      <Harness
        swrKey="k1"
        loadCached={() => cache.promise}
        fetchRemote={() => Promise.reject(new Error('network down'))}
        saveCache={() => Promise.resolve(new Date().toISOString())}
        onState={(state) => states.push(state)}
      />,
    );
    await flush();
    expect(states.at(-1)).toMatchObject({ data: undefined, offline: false });

    await act(async () => {
      cache.resolve({ value: ['cached'], savedAt: '2026-01-01T00:00:00.000Z' });
      await cache.promise;
    });
    await flush();

    const finalState = states.at(-1)!;
    expect(finalState.data).toEqual(['cached']);
    expect(finalState.offline).toBe(true);
  });

  it('bumping revalidateToken for the same key refetches without resetting data/loading (useCatalogue "catalogueWarm" case)', async () => {
    const network = deferred<string[]>();
    const fetchRemote = () => network.promise;
    const states: StaleWhileRevalidateState<string[]>[] = [];
    const { rerender } = render(
      <Harness
        swrKey="k1"
        loadCached={() => Promise.resolve({ value: ['initial'], savedAt: '2026-01-01T00:00:00.000Z' })}
        fetchRemote={() => Promise.resolve(['initial'])}
        saveCache={() => Promise.resolve(new Date().toISOString())}
        onState={(state) => states.push(state)}
        revalidateToken={1}
      />,
    );
    await flush();
    expect(states.at(-1)).toMatchObject({ data: ['initial'], loading: false, isRevalidating: false });

    rerender(
      <Harness
        swrKey="k1"
        loadCached={() => Promise.resolve({ value: ['initial'], savedAt: '2026-01-01T00:00:00.000Z' })}
        fetchRemote={fetchRemote}
        saveCache={() => Promise.resolve(new Date().toISOString())}
        onState={(state) => states.push(state)}
        revalidateToken={2}
      />,
    );
    await flush();
    // Forced revalidation must not clear what's already on screen, unlike a genuine key change.
    expect(states.at(-1)).toMatchObject({ data: ['initial'], loading: false, isRevalidating: true });

    await act(async () => {
      network.resolve(['refreshed']);
      await network.promise;
    });
    await flush();
    expect(states.at(-1)).toMatchObject({ data: ['refreshed'], isRevalidating: false });
  });

  // React 18 StrictMode (enabled in src/main.tsx) synchronously mounts every effect, cleans it
  // up, and mounts it again — dev-only, to catch effects that aren't safe to re-run. Without a
  // cleanup function undoing what it just did, the *second* mount would see the key as "already
  // seen" (set by the first, now-discarded mount) and skip `loadCached` entirely, permanently
  // stuck showing nothing — a real bug this exact test caught in a live browser (`npm run dev`)
  // that no other test here reproduces, since Testing Library's `render` doesn't wrap in
  // StrictMode by default.
  it('still applies the cache under React StrictMode\'s double mount/cleanup/mount (dev-only)', async () => {
    const states: StaleWhileRevalidateState<string[]>[] = [];
    render(
      <StrictMode>
        <Harness
          swrKey="k1"
          loadCached={() => Promise.resolve({ value: ['cached'], savedAt: '2026-01-01T00:00:00.000Z' })}
          fetchRemote={() => new Promise<string[]>(() => undefined)}
          saveCache={() => Promise.resolve(new Date().toISOString())}
          onState={(state) => states.push(state)}
        />
      </StrictMode>,
    );
    await flush();
    expect(states.at(-1)).toMatchObject({ data: ['cached'], loading: false });
  });
});
