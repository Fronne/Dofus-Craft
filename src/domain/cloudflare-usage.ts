// specs/058-admin-cloudflare-usage (data-model.md): the free plan's daily limits and the pure rules
// that turn a day's consumption into a percentage, a level and a gap-free history.
export const USAGE_METRICS = ['workersRequests', 'd1RowsRead', 'd1RowsWritten'] as const;
export type UsageMetric = (typeof USAGE_METRICS)[number];

// Cloudflare's free plan, per UTC day. Change here by hand if Cloudflare changes them.
export const USAGE_LIMITS: Record<UsageMetric, number> = {
  workersRequests: 100_000,
  d1RowsRead: 5_000_000,
  d1RowsWritten: 100_000,
};

export const USAGE_LABELS: Record<UsageMetric, string> = {
  workersRequests: 'Requêtes Workers',
  d1RowsRead: 'Lectures de lignes D1',
  d1RowsWritten: 'Écritures de lignes D1',
};

export const USAGE_WARNING_RATIO = 0.8;
export const USAGE_WINDOWS = [7, 30] as const;
export type UsageWindow = (typeof USAGE_WINDOWS)[number];

export type UsageDay = { date: string } & Record<UsageMetric, number>;
export type UsageLevel = 'ok' | 'warning' | 'over';
export type UsageSecret = 'CLOUDFLARE_API_TOKEN' | 'CLOUDFLARE_ACCOUNT_ID';

export type UsageResponse =
  | { state: 'ok'; days: UsageWindow; readAt: string; history: UsageDay[] }
  | { state: 'not-configured'; missing: UsageSecret[] }
  | { state: 'denied' }
  | { state: 'unavailable' };

export const isUsageWindow = (value: unknown): value is UsageWindow => value === 7 || value === 30;

// Rounded to the nearest whole percent, never capped (112 % stays 112 %).
export function usagePercent(used: number, limit: number): number {
  return used > 0 && limit > 0 ? Math.round((used / limit) * 100) : 0;
}

export function usageLevel(used: number, limit: number): UsageLevel {
  if (used >= limit) return 'over';
  return used >= limit * USAGE_WARNING_RATIO ? 'warning' : 'ok';
}

export const USAGE_LEVEL_TEXT: Record<UsageLevel, string> = {
  ok: 'Dans la limite',
  warning: 'Proche de la limite',
  over: 'Limite dépassée',
};

const DAY_MS = 86_400_000;
const utcDay = (time: number) => new Date(time).toISOString().slice(0, 10);

// The `days` UTC dates ending on `now`'s day, oldest first.
export function usageDates(days: number, now: Date): string[] {
  const today = Date.parse(utcDay(now.getTime()));
  return Array.from({ length: days }, (_, index) => utcDay(today - (days - 1 - index) * DAY_MS));
}

// One entry per date of the window: rows of the same date add up, a missing date is 0, dates outside
// the window are ignored.
export function fillUsageDays(days: number, now: Date, rows: UsageDay[]): UsageDay[] {
  const history = usageDates(days, now).map((date): UsageDay => ({ date, workersRequests: 0, d1RowsRead: 0, d1RowsWritten: 0 }));
  const byDate = new Map(history.map((day) => [day.date, day]));
  for (const row of rows) {
    const day = byDate.get(row.date);
    if (!day) continue;
    for (const metric of USAGE_METRICS) day[metric] += row[metric];
  }
  return history;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isCount = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0;

export function isUsageDay(value: unknown): value is UsageDay {
  return isRecord(value) && typeof value.date === 'string' && USAGE_METRICS.every((metric) => isCount(value[metric]));
}

export function parseUsageResponse(payload: unknown): UsageResponse | undefined {
  if (!isRecord(payload)) return undefined;
  switch (payload.state) {
    case 'ok':
      return isUsageWindow(payload.days) && typeof payload.readAt === 'string' && Array.isArray(payload.history) && payload.history.every(isUsageDay)
        ? { state: 'ok', days: payload.days, readAt: payload.readAt, history: payload.history }
        : undefined;
    case 'not-configured':
      return Array.isArray(payload.missing)
        ? { state: 'not-configured', missing: payload.missing.filter((name): name is UsageSecret => name === 'CLOUDFLARE_API_TOKEN' || name === 'CLOUDFLARE_ACCOUNT_ID') }
        : undefined;
    case 'denied':
      return { state: 'denied' };
    case 'unavailable':
      return { state: 'unavailable' };
    default:
      return undefined;
  }
}
