type CacheEntry<T> = { value: T; expiresAt: number };
const cache = new Map<string, CacheEntry<unknown>>();
const pending = new Map<string, Promise<unknown>>();
// DofusDB's catalogue barely changes (roughly once every two weeks), and this cache lives only
// in memory anyway (cleared on reload), so a long TTL just avoids needless refetches within a
// single long-lived tab without any real staleness risk.
const TTL = 24 * 60 * 60 * 1000;

export function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const current = cache.get(key);
  if (current && current.expiresAt > Date.now()) return Promise.resolve(current.value as T);
  const existing = pending.get(key);
  if (existing) return existing as Promise<T>;
  const promise = loader().then((value) => {
    cache.set(key, { value, expiresAt: Date.now() + TTL });
    pending.delete(key);
    return value;
  }, (error: unknown) => {
    pending.delete(key);
    throw error;
  });
  pending.set(key, promise);
  return promise;
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
