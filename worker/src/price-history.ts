import { outlierBounds } from './median';

// specs/018-price-history-windows (revises specs/017): a resource's or an item's shared prices over
// the last 24 hours, 7 days and 30 days, one entry per contribution — no per-device dedup, no
// grouping. Only the amount and the time (to the minute) leave the Worker, never a device id
// (FR-006, research.md §2).

export type HistoryWindow = 'day' | 'week' | 'month';
export type SharedPrice = { amountKamas: number; sharedAt: string };
export type PriceHistory = Record<HistoryWindow, SharedPrice[]>;
export type HistoryRow = { amountKamas: number; createdAt: string };

const HOUR = 60 * 60 * 1000;
const WINDOW_MS: Record<HistoryWindow, number> = { day: 24 * HOUR, week: 7 * 24 * HOUR, month: 30 * 24 * HOUR };

function toMinute(iso: string): string {
  const time = Date.parse(iso);
  return new Date(time - (time % 60_000)).toISOString();
}

// research.md §3: sliding window with an inclusive start, then outlier bounds over the window's own
// amounts (specs/004 FR-012, no effect under 4 values), then oldest first.
function windowPrices(rows: HistoryRow[], start: number): SharedPrice[] {
  const inWindow = rows.filter((row) => Date.parse(row.createdAt) >= start);
  const [low, high] = outlierBounds(inWindow.map((row) => row.amountKamas).sort((a, b) => a - b));
  return inWindow
    .filter((row) => row.amountKamas >= low && row.amountKamas <= high)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
    .map((row) => ({ amountKamas: row.amountKamas, sharedAt: toMinute(row.createdAt) }));
}

export function computePriceHistory(rows: HistoryRow[], now: Date = new Date()): PriceHistory {
  const at = now.getTime();
  return {
    day: windowPrices(rows, at - WINDOW_MS.day),
    week: windowPrices(rows, at - WINDOW_MS.week),
    month: windowPrices(rows, at - WINDOW_MS.month),
  };
}

// The one D1 call this needs, typed structurally (like latest.ts) so the module also compiles in the
// app's own test setup, which doesn't load the Workers types.
type HistoryDb = {
  prepare(sql: string): { bind(...values: unknown[]): { all<T>(): Promise<{ results: T[] }> } };
};

function isKind(value: string | null): value is 'resource' | 'item' {
  return value === 'resource' || value === 'item';
}

// GET /price-history (contracts/price-history-api.md), as a status + body pair so index.ts only wraps
// it in a JSON response. No price yet is a normal 200 with empty lists, not a 404.
export async function priceHistoryResponse(db: HistoryDb, url: URL, now: Date = new Date()): Promise<{ status: number; body: unknown }> {
  const kind = url.searchParams.get('kind');
  const id = url.searchParams.get('id');
  const serverId = url.searchParams.get('serverId');
  if (!isKind(kind) || !id || !serverId) {
    return { status: 400, body: { error: 'kind (resource or item), id and serverId are required' } };
  }
  const { results } = await db.prepare(
    `SELECT amount_kamas, created_at FROM community_price_contributions
     WHERE resource_id = ? AND server_id = ? AND kind = ? AND created_at >= ?`,
  ).bind(id, serverId, kind, new Date(now.getTime() - WINDOW_MS.month).toISOString())
    .all<{ amount_kamas: number; created_at: string }>();
  const history = computePriceHistory(results.map((row) => ({ amountKamas: row.amount_kamas, createdAt: row.created_at })), now);
  return { status: 200, body: history };
}
