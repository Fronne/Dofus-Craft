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

// specs/070-admin-dashboard-graphiques (data-model.md « Journée Cloudflare »): the current UTC day, hour by hour.
// The server sends each hour's own consumption; the running total and the hours where 80 % / 100 % of a limit
// were reached are worked out here, as pure rules.
export type UsageHour = { hour: number } & Record<UsageMetric, number>;

export type TodayUsageResponse =
  | { state: 'ok'; date: string; readAt: string; hours: UsageHour[] }
  | { state: 'not-configured'; missing: UsageSecret[] }
  | { state: 'denied' }
  | { state: 'unavailable' };

export type CumulativeHour = {
  hour: number;
  // The last hour is the one still running: its figures are not final.
  partial: boolean;
  used: Record<UsageMetric, number>;
  percent: Record<UsageMetric, number>;
};

export type ThresholdCrossing = { metric: UsageMetric; level: 'warning' | 'over'; hour: number };

// One entry per hour from 0 to `now`'s hour; rows of the same hour add up, an hour without a row is 0, hours
// outside the day (or not a whole hour from 0 to 23) are ignored.
export function fillTodayHours(now: Date, rows: UsageHour[]): UsageHour[] {
  const hours = Array.from({ length: now.getUTCHours() + 1 }, (_, hour): UsageHour => ({ hour, workersRequests: 0, d1RowsRead: 0, d1RowsWritten: 0 }));
  for (const row of rows) {
    const entry = Number.isInteger(row.hour) ? hours[row.hour] : undefined;
    if (!entry) continue;
    for (const metric of USAGE_METRICS) entry[metric] += row[metric];
  }
  return hours;
}

const noUsage = (): Record<UsageMetric, number> => ({ workersRequests: 0, d1RowsRead: 0, d1RowsWritten: 0 });

// The running total since 00:00 UTC, and its percentage of each limit (rounded, never capped).
export function cumulativeHours(hours: UsageHour[]): CumulativeHour[] {
  const used = noUsage();
  return hours.map((entry, index) => {
    for (const metric of USAGE_METRICS) used[metric] += entry[metric];
    const percent = noUsage();
    for (const metric of USAGE_METRICS) percent[metric] = usagePercent(used[metric], USAGE_LIMITS[metric]);
    return { hour: entry.hour, partial: index === hours.length - 1, used: { ...used }, percent };
  });
}

// For each metric, the first hour whose running total reached 80 % (`warning`) and the first that reached 100 %
// (`over`) of its limit; nothing for a level never reached.
export function thresholdCrossings(cumulative: CumulativeHour[]): ThresholdCrossing[] {
  const crossings: ThresholdCrossing[] = [];
  for (const metric of USAGE_METRICS) {
    for (const level of ['warning', 'over'] as const) {
      const reached = cumulative.find((entry) => {
        const current = usageLevel(entry.used[metric], USAGE_LIMITS[metric]);
        return level === 'warning' ? current !== 'ok' : current === 'over';
      });
      if (reached) crossings.push({ metric, level, hour: reached.hour });
    }
  }
  return crossings;
}

export const crossingText = (crossing: ThresholdCrossing) =>
  `${USAGE_LABELS[crossing.metric]} : ${crossing.level === 'warning' ? '80' : '100'} % franchi à ${crossing.hour} h UTC`;

export function isUsageHour(value: unknown): value is UsageHour {
  return isRecord(value) && typeof value.hour === 'number' && Number.isInteger(value.hour) && value.hour >= 0 && value.hour <= 23 &&
    USAGE_METRICS.every((metric) => isCount(value[metric]));
}

export function parseTodayUsageResponse(payload: unknown): TodayUsageResponse | undefined {
  if (isRecord(payload) && payload.state === 'ok') {
    return typeof payload.date === 'string' && typeof payload.readAt === 'string' && Array.isArray(payload.hours) && payload.hours.every(isUsageHour)
      ? { state: 'ok', date: payload.date, readAt: payload.readAt, hours: payload.hours }
      : undefined;
  }
  // The other states are the same as for the history.
  const other = parseUsageResponse(payload);
  return other === undefined || other.state === 'ok' ? undefined : other;
}
