import { useEffect, useRef, useState } from 'react';

export type StaleWhileRevalidateState<T> = {
  data: T | undefined;
  loading: boolean;
  isRevalidating: boolean;
  offline: boolean;
  error: unknown;
  lastSyncedAt: string | undefined;
};

const EMPTY_STATE: StaleWhileRevalidateState<never> = {
  data: undefined,
  loading: false,
  isRevalidating: false,
  offline: false,
  error: undefined,
  lastSyncedAt: undefined,
};

function defaultIsEqual<T>(a: T, b: T): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// Generic cache-then-revalidate hook (specs/010-search-instant-cache): shows whatever is already
// known locally the instant it resolves, kicks off a network refresh in parallel, and only ever
// touches `data` again if the network result actually differs (FR-004).
//
// Race conditions are guarded the same way every other hook in this codebase guards a stale async
// resolution — a `cancelled` flag local to each effect invocation, set in its cleanup — rather
// than a shared "generation" counter mutated across invocations. That distinction matters under
// React 18 StrictMode (enabled in src/main.tsx): dev-only, it mounts every effect, cleans it up,
// and mounts it again synchronously to test effect purity. A shared ref written unconditionally at
// the *start* of each invocation (as an earlier version of this hook did) gets desynchronized by
// that double invocation — the second (real, lasting) mount sees the ref already touched by the
// first (immediately discarded) one and wrongly concludes there's nothing left to do, permanently
// skipping `loadCached` (caught live in a browser via `npm run dev`, see
// tests/unit/use-stale-while-revalidate.test.tsx's dedicated StrictMode test). A per-invocation
// `cancelled` closure has no such shared state to desynchronize.
//
// `dataKeyRef` is the one piece of state that *is* intentionally shared and mutated across
// invocations — but only ever by a non-cancelled (winning) one, which is what makes it immune to
// the same problem: a cancelled invocation's callbacks bail out on `cancelled` before ever writing
// to it, so the next invocation always sees an accurate answer to "is there already committed data
// for this key" (FR-006), never a false "yes" left behind by an invocation that got discarded
// before actually applying anything.
export function useStaleWhileRevalidate<T>({
  key,
  loadCached,
  fetchRemote,
  saveCache,
  isEqual = defaultIsEqual,
  revalidateToken,
}: {
  key: string | undefined;
  loadCached: (key: string) => Promise<{ value: T; savedAt: string } | undefined>;
  fetchRemote: (key: string) => Promise<T>;
  saveCache: (key: string, value: T) => Promise<string>;
  isEqual?: (a: T, b: T) => boolean;
  // Bump this (any value change) to force a fresh `fetchRemote` for the *same* `key`, without the
  // "new key" reset to `loading: true`/`data: undefined` — e.g. useCatalogue's background full
  // catalogue index becoming ready should silently refresh already-visible search results, not
  // flash a skeleton over them. Changing `key` itself always still resets (a genuinely new query).
  revalidateToken?: string | number;
}): StaleWhileRevalidateState<T> {
  const [state, setState] = useState<StaleWhileRevalidateState<T>>(EMPTY_STATE);
  // Which key `dataRef.current` actually belongs to — see the function-level comment above for why
  // this (rather than "did we start a request for this key") is what "fresh key" is based on.
  const dataKeyRef = useRef<string | undefined>(undefined);
  const dataRef = useRef<T | undefined>(undefined);
  // `networkSucceededRef` only ever flips on a *successful* response — it's the one guard allowed
  // to block a still-pending cache read from applying (FR-010: never let a stale cache read
  // overwrite fresher network data). A network *failure* must never set it: otherwise a network
  // error that settles before a slower local cache read would permanently discard that cache read
  // once it arrives, even though a failure has no fresher data to protect (see
  // tests/unit/use-stale-while-revalidate.test.tsx, "keeps showing cached data ... offline").
  // `networkSettledRef` tracks both outcomes, just to stop the cache handler from claiming
  // `isRevalidating: true` once the network has already settled either way.
  const networkSucceededRef = useRef(false);
  const networkSettledRef = useRef(false);
  // Set only in the failure branch — read by the cache handler so that a cache read resolving
  // *after* the network already failed still surfaces as offline, instead of silently reporting
  // `offline: false` just because it happened to apply after the failure handler already ran.
  const networkFailedRef = useRef(false);

  useEffect(() => {
    if (!key) {
      dataKeyRef.current = undefined;
      dataRef.current = undefined;
      setState(EMPTY_STATE);
      return;
    }

    let cancelled = false;
    const isFreshKey = key !== dataKeyRef.current;

    networkSucceededRef.current = false;
    networkSettledRef.current = false;
    networkFailedRef.current = false;

    if (isFreshKey) {
      dataRef.current = undefined;
      setState({ data: undefined, loading: true, isRevalidating: false, offline: false, error: undefined, lastSyncedAt: undefined });
    } else {
      setState((current) => ({ ...current, isRevalidating: true }));
    }

    if (isFreshKey) {
      loadCached(key)
        .catch(() => undefined)
        .then((cached) => {
          if (cancelled || networkSucceededRef.current || !cached) return;
          dataRef.current = cached.value;
          dataKeyRef.current = key;
          setState((current) => ({
            ...current,
            data: cached.value,
            loading: false,
            isRevalidating: !networkSettledRef.current,
            offline: networkFailedRef.current,
            lastSyncedAt: cached.savedAt,
          }));
        });
    }

    async function revalidate() {
      try {
        const value = await fetchRemote(key!);
        if (cancelled) return;
        networkSucceededRef.current = true;
        networkSettledRef.current = true;
        const changed = dataRef.current === undefined || !isEqual(dataRef.current, value);
        const syncedAt = new Date().toISOString();
        if (changed) dataRef.current = value;
        dataKeyRef.current = key!;
        // Update the visible state right away — FR-001/SC-001 require an instant display, and a
        // slow (or, in production, occasionally failing) cache write must never delay that. The
        // persist-for-next-time write below is a fire-and-forget side effect, not a gate on this.
        setState((current) => ({
          ...current,
          data: changed ? value : current.data,
          loading: false,
          isRevalidating: false,
          offline: false,
          error: undefined,
          lastSyncedAt: syncedAt,
        }));
        void saveCache(key!, value).catch(() => undefined);
      } catch (error) {
        if (cancelled) return;
        networkSettledRef.current = true;
        networkFailedRef.current = true;
        setState((current) => ({
          ...current,
          loading: false,
          isRevalidating: false,
          offline: current.data !== undefined,
          error,
        }));
      }
    }

    void revalidate();

    return () => {
      cancelled = true;
    };
  }, [key, revalidateToken]);

  return state;
}
