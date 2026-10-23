import { catalogueCache } from '../persistence/indexeddb-catalogue-cache-store';

type CacheEntry<T> = { value: T; expiresAt: number };
const cache = new Map<string, CacheEntry<unknown>>();
const pending = new Map<string, Promise<unknown>>();
// DofusDB's catalogue barely changes (roughly once every two weeks), and this cache lives only
// in memory anyway (cleared on reload), so a long TTL just avoids needless refetches within a
// single long-lived tab without any real staleness risk.
const TTL = 24 * 60 * 60 * 1000;
// specs/021-background-data-loading (FR-003): how long a copy kept on the device is used as is. An
// older one is still served at once (it's far better than waiting on the network for data that
// almost never changes) while a fresh copy is fetched in the background for the next read.
export const PERSISTED_FRESH_MS = 24 * 60 * 60 * 1000;

export type PersistentStore = {
  getVersioned(key: string): Promise<{ value: unknown; savedAt: string } | undefined>;
  set(key: string, value: unknown): Promise<string>;
};

// specs/021 (FR-001, FR-005): the device copy, behind a swappable store so tests can isolate it.
// Any failure (private browsing, quota, no IndexedDB at all) just falls back to memory + network.
let persistentStore: PersistentStore | undefined = catalogueCache;

export function setPersistentStore(store: PersistentStore | undefined): void {
  persistentStore = store;
}

async function readPersisted(key: string): Promise<{ value: unknown; savedAt: string } | undefined> {
  if (!persistentStore) return undefined;
  try {
    return await persistentStore.getVersioned(key);
  } catch {
    return undefined;
  }
}

function writePersisted(key: string, value: unknown): void {
  if (!persistentStore) return;
  // Never awaited: the caller already has the value, the device copy is only for next time.
  persistentStore.set(key, value).catch(() => undefined);
}

function remember<T>(key: string, value: T): void {
  cache.set(key, { value, expiresAt: Date.now() + TTL });
}

function fetchAndStore<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const existing = pending.get(key);
  if (existing) return existing as Promise<T>;
  const promise = loader().then((value) => {
    remember(key, value);
    writePersisted(key, value);
    pending.delete(key);
    return value;
  }, (error: unknown) => {
    pending.delete(key);
    throw error;
  });
  pending.set(key, promise);
  return promise;
}

export function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const current = cache.get(key);
  if (current && current.expiresAt > Date.now()) return Promise.resolve(current.value as T);
  const existing = pending.get(key);
  if (existing) return existing as Promise<T>;
  const promise: Promise<T> = readPersisted(key).then((persisted) => {
    // Hand the `pending` slot over to the network load (if any), so it isn't mistaken for this one.
    if (pending.get(key) === promise) pending.delete(key);
    if (!persisted) return fetchAndStore(key, loader);
    remember(key, persisted.value as T);
    if (Date.now() - Date.parse(persisted.savedAt) >= PERSISTED_FRESH_MS) {
      // Stale device copy: served now, refreshed quietly for the next read (research.md §2).
      fetchAndStore(key, loader).catch(() => undefined);
    }
    return persisted.value as T;
  });
  pending.set(key, promise);
  return promise;
}

// specs/021 (SC-001): copies device entries into memory so synchronous `peekCached` readers (the
// search's "is the full index already here?" checks) see them right from app start.
export async function hydrateFromPersistentStore(keys: string[]): Promise<void> {
  await Promise.all(keys.map(async (key) => {
    const current = cache.get(key);
    if (current && current.expiresAt > Date.now()) return;
    const persisted = await readPersisted(key);
    if (persisted && !cache.has(key)) remember(key, persisted.value);
  }));
}

export function peekCached<T>(key: string): T | undefined {
  const current = cache.get(key);
  if (!current || current.expiresAt <= Date.now()) return undefined;
  return current.value as T;
}

export function clearCache(): void {
  cache.clear();
  pending.clear();
}

// specs/072-snapshot-catalogue-statique: puts a complete, already-built value (from the shipped
// snapshot or a full re-download) in memory and on the device, replacing any previous copy at once.
export function seedCache<T>(key: string, value: T): void {
  remember(key, value);
  writePersisted(key, value);
}
