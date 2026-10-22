import { usageDates } from '../../src/domain/cloudflare-usage';

// specs/070-admin-dashboard-graphiques (contracts/admin-dashboard-api.md « Activité »): the community prices added and the
// visitors seen over the last 30 UTC days. Totals only: never a device identifier, a resource or a key (FR-016).
// The reads go through the indexes of migrations/0022_add_dashboard_indexes.sql, so they only touch these 30 days.
type Statement = { bind(...values: unknown[]): Statement; all<T>(): Promise<{ results: T[] }> };
export type ActivityDb = { prepare(sql: string): Statement };

export const PRICE_ORIGINS = ['manual', 'capture', 'bot', 'sniffer'] as const;
export type PriceOrigin = (typeof PRICE_ORIGINS)[number];
export const ACTIVITY_DAYS = 30;

export type ActivityDay = { date: string; prices: Record<PriceOrigin, number>; visitors: number };
export type Activity = { days: ActivityDay[]; pricesTotal: number; visitorsToday: number };

const isOrigin = (value: unknown): value is PriceOrigin => PRICE_ORIGINS.includes(value as PriceOrigin);

export async function readActivity(db: ActivityDb, now: Date = new Date()): Promise<Activity> {
  const dates = usageDates(ACTIVITY_DAYS, now);
  const since = dates[0];
  const prices = await db.prepare(
    'SELECT substr(created_at, 1, 10) AS day, origin, COUNT(*) AS total FROM community_price_contributions WHERE created_at >= ? GROUP BY day, origin',
  ).bind(since).all<{ day: string; origin: string; total: number }>();
  const visits = await db.prepare('SELECT day, COUNT(*) AS total FROM app_visits WHERE day >= ? GROUP BY day')
    .bind(since).all<{ day: string; total: number }>();

  const days = new Map(dates.map((date): [string, ActivityDay] => [date, { date, prices: { manual: 0, capture: 0, bot: 0, sniffer: 0 }, visitors: 0 }]));
  for (const row of prices.results) {
    const day = days.get(row.day);
    // An origin this dashboard does not know is left out rather than guessed at.
    if (day && isOrigin(row.origin)) day.prices[row.origin] += Number(row.total);
  }
  for (const row of visits.results) {
    const day = days.get(row.day);
    if (day) day.visitors += Number(row.total);
  }

  const list = [...days.values()];
  return {
    days: list,
    pricesTotal: list.reduce((sum, day) => sum + PRICE_ORIGINS.reduce((inner, origin) => inner + day.prices[origin], 0), 0),
    visitorsToday: list[list.length - 1].visitors,
  };
}
