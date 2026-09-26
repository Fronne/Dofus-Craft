import { outlierBounds, percentileCont, type ContributionRow } from './median';
import { retentionCutoff } from './retention';

// specs/017-price-history-chart: a resource's or an item's price history over the 90 retained days,
// as one median per day, week and month (Paris calendar). Only these per-period aggregates ever
// leave the Worker (FR-006) — never a contribution, a device id or an individual timestamp.

export type Grouping = 'day' | 'week' | 'month';
export type HistoryPoint = { periodStart: string; medianAmountKamas: number; sampleSize: number };
export type PriceHistory = Record<Grouping, HistoryPoint[]>;

// FR-008: periods follow the Paris calendar. 'en-CA' formats as YYYY-MM-DD.
const parisDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function parisDate(iso: string): string {
  return parisDateFormatter.format(new Date(iso));
}

// Works on the civil date itself (as UTC midnight), so a daylight-saving change can't shift it.
export function periodStartFor(date: string, grouping: Grouping): string {
  if (grouping === 'day') return date;
  if (grouping === 'month') return `${date.slice(0, 8)}01`;
  const day = new Date(`${date}T00:00:00.000Z`);
  const daysSinceMonday = (day.getUTCDay() + 6) % 7;
  day.setUTCDate(day.getUTCDate() - daysSinceMonday);
  return day.toISOString().slice(0, 10);
}

// research.md §3, in this order: 90-day window, Paris period, every contribution kept (spec FR-004,
// révision : unlike the current price, a device counts once per price it shared), outlier bounds
// over every row kept for the grouping (specs/004 FR-012 — per period there would rarely be the 4
// values needed), then median and count per period. A period emptied by the filter disappears.
function groupHistory(rows: ContributionRow[], grouping: Grouping): HistoryPoint[] {
  const byPeriod = new Map<string, ContributionRow[]>();
  for (const row of rows) {
    const period = periodStartFor(parisDate(row.createdAt), grouping);
    byPeriod.set(period, [...(byPeriod.get(period) ?? []), row]);
  }
  const kept = [...byPeriod];
  const [low, high] = outlierBounds(kept.flatMap(([, periodRows]) => periodRows.map((row) => row.amountKamas)).sort((a, b) => a - b));
  const points: HistoryPoint[] = [];
  for (const [periodStart, periodRows] of kept) {
    const amounts = periodRows.map((row) => row.amountKamas).filter((amount) => amount >= low && amount <= high).sort((a, b) => a - b);
    if (amounts.length === 0) continue;
    points.push({ periodStart, medianAmountKamas: Math.round(percentileCont(amounts, 0.5)), sampleSize: amounts.length });
  }
  return points.sort((a, b) => a.periodStart.localeCompare(b.periodStart));
}

export function computePriceHistory(rows: ContributionRow[], now: Date = new Date()): PriceHistory {
  const cutoff = retentionCutoff(now);
  const recent = rows.filter((row) => row.createdAt >= cutoff);
  return { day: groupHistory(recent, 'day'), week: groupHistory(recent, 'week'), month: groupHistory(recent, 'month') };
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
    `SELECT amount_kamas, created_at, device_id FROM community_price_contributions
     WHERE resource_id = ? AND server_id = ? AND kind = ? AND created_at >= ?`,
  ).bind(id, serverId, kind, retentionCutoff(now)).all<{ amount_kamas: number; created_at: string; device_id: string }>();
  const history = computePriceHistory(results.map((row) => ({
    amountKamas: row.amount_kamas,
    createdAt: row.created_at,
    deviceId: row.device_id,
  })), now);
  return { status: 200, body: history };
}
