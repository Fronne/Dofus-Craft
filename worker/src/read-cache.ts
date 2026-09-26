// specs/021-background-data-loading (FR-012, research.md §6): a short-lived cache of read responses,
// in this isolate's memory. The worker is served on *.workers.dev, where Cloudflare's Cache API has
// no effect, so this is what spares D1 from re-reading the same prices within a minute. Each isolate
// has its own copy: another player may see a new contribution up to READ_CACHE_TTL_MS late.
export const READ_CACHE_TTL_MS = 60_000;
const MAX_ENTRIES = 500;

type Entry = { status: number; body: unknown; expiresAt: number };
const entries = new Map<string, Entry>();

// Key: the path and its sorted query (without `fresh`), so parameter order doesn't matter.
export function readCacheKey(url: URL): string {
  const params = [...url.searchParams.entries()]
    .filter(([name]) => name !== 'fresh')
    .sort(([a], [b]) => a.localeCompare(b));
  return `${url.pathname}?${new URLSearchParams(params).toString()}`;
}

export function getCached(key: string, now = Date.now()): { status: number; body: unknown } | undefined {
  const entry = entries.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= now) {
    entries.delete(key);
    return undefined;
  }
  return { status: entry.status, body: entry.body };
}

export function setCached(key: string, status: number, body: unknown, now = Date.now()): void {
  entries.delete(key);
  entries.set(key, { status, body, expiresAt: now + READ_CACHE_TTL_MS });
  // Map keeps insertion order: the first keys are the oldest.
  while (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value as string);
}

// Called after an accepted contribution: this isolate's next reads go back to the database.
export function clearReadCache(): void {
  entries.clear();
}

// specs/021 (FR-012, FR-013, contracts/community-prices.md): serves a price read from the cache,
// except with `fresh=1` (the read a player makes right after contributing), and says how the
// browser may cache the answer.
export async function cachedRead(
  url: URL,
  read: () => Promise<{ status: number; body: unknown }>,
): Promise<{ status: number; body: unknown; headers: Record<string, string> }> {
  if (url.searchParams.get('fresh') === '1') {
    return { ...await read(), headers: { 'Cache-Control': 'no-store' } };
  }
  const key = readCacheKey(url);
  const hit = getCached(key);
  const { status, body } = hit ?? await read();
  const cacheable = status === 200 || status === 404;
  if (!hit && cacheable) setCached(key, status, body);
  return { status, body, headers: cacheable ? { 'Cache-Control': 'public, max-age=60' } : {} };
}
