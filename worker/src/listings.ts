import { MAX_AMOUNT_KAMAS } from './contribution';
import { isKnownServer } from './servers';
import { DEFAULT_THRESHOLD_PERCENT, MAX_THRESHOLD, MIN_THRESHOLD } from '../../src/domain/good-deals';

// specs/078-bons-plans-hdv: the copies of an equipment on sale at the HDV (table hdv_listings), written by
// the friends' tool (sniffer.ts, `copies` of an observation) and read by GET /bons-plans. The Worker judges
// nothing: the site computes the good deals (src/domain/good-deals.ts).

export const MAX_COPIES_PER_OBSERVATION = 50;
export const MAX_STAT_LINES = 40;
// Copies one key may write on a UTC day, apart from the 5000 observations (research R5).
export const COPY_DAILY_LIMIT = 20_000;
// An item is only served with this many fresh copies: three comparable ones and the judged one.
export const MIN_COPIES_SERVED = 4;
export const MAX_LISTINGS_SERVED = 5000;
export const LISTING_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const DEFAULT_GOOD_DEAL_THRESHOLD = DEFAULT_THRESHOLD_PERCENT;
export const GOOD_DEAL_THRESHOLD_KEY = 'good_deal_threshold';

export type StatLine = { effectId: number; value: number };
export type Copy = { listingId: string; price: number; stats: StatLine[] };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function parseStat(value: unknown): StatLine | undefined {
  if (!isRecord(value)) return undefined;
  const { effectId, value: amount } = value;
  if (typeof effectId !== 'number' || !Number.isInteger(effectId) || effectId <= 0) return undefined;
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < -10_000 || amount > 10_000) return undefined;
  return { effectId, value: amount };
}

/** The copies of an observation (contracts/sniffer-copies.md), or undefined when any one is invalid. */
export function parseCopies(value: unknown): Copy[] | undefined {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_COPIES_PER_OBSERVATION) return undefined;
  const seen = new Set<string>();
  const copies: Copy[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) return undefined;
    const { listingId, price, stats } = entry;
    if (typeof listingId !== 'string' || !/^\d{1,20}$/.test(listingId) || seen.has(listingId)) return undefined;
    if (typeof price !== 'number' || !Number.isInteger(price) || price <= 0 || price > MAX_AMOUNT_KAMAS) return undefined;
    if (!Array.isArray(stats) || stats.length < 1 || stats.length > MAX_STAT_LINES) return undefined;
    const lines = stats.map(parseStat);
    if (lines.some((line) => line === undefined)) return undefined;
    seen.add(listingId);
    copies.push({ listingId, price, stats: lines as StatLine[] });
  }
  return copies;
}

// 8 bound values a row, and a D1 statement takes at most 100.
const ROWS_PER_STATEMENT = 10;

/**
 * The statements replacing the listings of one item on one server by `copies`: an upsert per group of
 * rows (first_seen_at is kept), then one delete of the listings the lot no longer carries.
 */
export function listingStatements<S>(
  db: { prepare(sql: string): { bind(...values: unknown[]): S } },
  serverId: string,
  itemId: string,
  copies: Copy[],
  keyId: string,
  now: Date,
): S[] {
  const seenAt = now.toISOString();
  const statements: S[] = [];
  for (let start = 0; start < copies.length; start += ROWS_PER_STATEMENT) {
    const group = copies.slice(start, start + ROWS_PER_STATEMENT);
    statements.push(db.prepare(
      `INSERT INTO hdv_listings (server_id, listing_id, item_id, price_kamas, stats_json, first_seen_at, last_seen_at, key_id)
       VALUES ${group.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}
       ON CONFLICT (server_id, listing_id) DO UPDATE SET
         item_id = excluded.item_id, price_kamas = excluded.price_kamas, stats_json = excluded.stats_json,
         last_seen_at = excluded.last_seen_at, key_id = excluded.key_id`,
    ).bind(...group.flatMap((copy) => [serverId, copy.listingId, itemId, copy.price, JSON.stringify(copy.stats), seenAt, seenAt, keyId])));
  }
  // Only what this key itself saw earlier is dropped: another friend may see other copies, and a lot cut at
  // the maximum may be a partial view. Copies nobody revisits leave after 24 hours anyway.
  if (copies.length < MAX_COPIES_PER_OBSERVATION) {
    statements.push(db.prepare(
      `DELETE FROM hdv_listings WHERE server_id = ? AND item_id = ? AND key_id = ? AND listing_id NOT IN (${copies.map(() => '?').join(', ')})`,
    ).bind(serverId, itemId, keyId, ...copies.map((copy) => copy.listingId)));
  }
  return statements;
}

type ReadDb = {
  prepare(sql: string): { bind(...values: unknown[]): { all<T>(): Promise<{ results: T[] }>; first<T>(): Promise<T | null> } };
};

type ListingRow = { listing_id: string; item_id: string; price_kamas: number; stats_json: string; last_seen_at: string };

/** The threshold set in the admin (numeric_settings), else 25; a value out of bounds or unreadable counts as unset. */
export async function readGoodDealThreshold(db: ReadDb): Promise<number> {
  try {
    const row = await db.prepare(`SELECT value FROM numeric_settings WHERE key = ?`).bind(GOOD_DEAL_THRESHOLD_KEY).first<{ value: string }>();
    const threshold = Number(row?.value);
    return Number.isInteger(threshold) && threshold >= MIN_THRESHOLD && threshold <= MAX_THRESHOLD ? threshold : DEFAULT_GOOD_DEAL_THRESHOLD;
  } catch {
    return DEFAULT_GOOD_DEAL_THRESHOLD;
  }
}

/** GET /bons-plans?server= (contracts/bons-plans-api.md): the fresh listings of the items that have enough of them. */
export async function bonsPlansResponse(db: ReadDb, url: URL, now: Date = new Date()): Promise<{ status: number; body: unknown }> {
  const serverId = url.searchParams.get('server');
  if (!serverId || !isKnownServer(serverId)) return { status: 400, body: { error: 'unknown_server' } };
  const threshold = await readGoodDealThreshold(db);
  const since = new Date(now.getTime() - LISTING_MAX_AGE_MS).toISOString();
  let rows: ListingRow[] = [];
  try {
    ({ results: rows } = await db.prepare(
      `SELECT listing_id, item_id, price_kamas, stats_json, last_seen_at FROM hdv_listings
       WHERE server_id = ? AND last_seen_at >= ? AND item_id IN (
         SELECT item_id FROM hdv_listings WHERE server_id = ? AND last_seen_at >= ? GROUP BY item_id HAVING COUNT(*) >= ?)
       ORDER BY last_seen_at DESC LIMIT ?`,
    ).bind(serverId, since, serverId, since, MIN_COPIES_SERVED, MAX_LISTINGS_SERVED).all<ListingRow>());
  } catch {
    // The table not created yet is no listing at all, as /site-settings falls back to its defaults.
    rows = [];
  }
  const listings = rows.flatMap((row) => {
    try {
      return [{ listingId: row.listing_id, itemId: row.item_id, priceKamas: row.price_kamas, lastSeenAt: row.last_seen_at, stats: JSON.parse(row.stats_json) as StatLine[] }];
    } catch {
      return [];
    }
  });
  return { status: 200, body: { thresholdPercent: threshold, maxAgeHours: LISTING_MAX_AGE_MS / 3_600_000, generatedAt: now.toISOString(), listings } };
}

/** Removes the listings not seen for a day (the weekly purge, specs/078 FR-011); returns how many. */
export async function purgeStaleListings(
  db: { prepare(sql: string): { bind(...values: unknown[]): { run(): Promise<{ meta: { changes: number } }> } } },
  now: Date = new Date(),
): Promise<number> {
  const result = await db.prepare(`DELETE FROM hdv_listings WHERE last_seen_at < ?`)
    .bind(new Date(now.getTime() - LISTING_MAX_AGE_MS).toISOString()).run();
  return result.meta.changes;
}
