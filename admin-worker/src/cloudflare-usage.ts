import {
  fillTodayHours,
  fillUsageDays,
  usageDates,
  type TodayUsageResponse,
  type UsageDay,
  type UsageHour,
  type UsageResponse,
  type UsageSecret,
  type UsageWindow,
} from '../../src/domain/cloudflare-usage';

// specs/058-admin-cloudflare-usage (research.md §1, §4): the only module that talks to Cloudflare's
// GraphQL Analytics API. The token never leaves it: every outcome is reduced to a UsageResponse.
export type UsageEnv = { CLOUDFLARE_API_TOKEN?: string; CLOUDFLARE_ACCOUNT_ID?: string };
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export const GRAPHQL_URL = 'https://api.cloudflare.com/client/v4/graphql';

// Account-level datasets: the free plan's limits apply to the whole account, not to one Worker.
export const USAGE_QUERY = `query Usage($account: String!, $from: Date!, $to: Date!, $fromTime: Time!, $toTime: Time!) {
  viewer {
    accounts(filter: { accountTag: $account }) {
      workers: workersInvocationsAdaptive(limit: 10000, filter: { datetime_geq: $fromTime, datetime_leq: $toTime }) {
        sum { requests }
        dimensions { datetimeHour }
      }
      d1: d1AnalyticsAdaptiveGroups(limit: 100, filter: { date_geq: $from, date_leq: $to }) {
        sum { rowsRead rowsWritten }
        dimensions { date }
      }
    }
  }
}`;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const count = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0);

function groups(value: unknown): Record<string, unknown>[] | undefined {
  return Array.isArray(value) && value.every(isRecord) ? value : undefined;
}

// Rows of both datasets → one UsageDay per row (they are summed per date by fillUsageDays).
function readRows(account: Record<string, unknown>): UsageDay[] | undefined {
  const workers = groups(account.workers);
  const d1 = groups(account.d1);
  if (!workers || !d1) return undefined;
  const rows: UsageDay[] = [];
  for (const group of workers) {
    const hour = isRecord(group.dimensions) ? group.dimensions.datetimeHour : undefined;
    const date = typeof hour === 'string' ? hour.slice(0, 10) : undefined;
    const sum = isRecord(group.sum) ? group.sum : {};
    if (typeof date !== 'string') return undefined;
    rows.push({ date, workersRequests: count(sum.requests), d1RowsRead: 0, d1RowsWritten: 0 });
  }
  for (const group of d1) {
    const date = isRecord(group.dimensions) ? group.dimensions.date : undefined;
    const sum = isRecord(group.sum) ? group.sum : {};
    if (typeof date !== 'string') return undefined;
    rows.push({ date, workersRequests: 0, d1RowsRead: count(sum.rowsRead), d1RowsWritten: count(sum.rowsWritten) });
  }
  return rows;
}

const isAuthError = (errors: unknown[]) =>
  errors.some((error) => {
    const text = isRecord(error) ? `${String(error.message ?? '')} ${JSON.stringify(error.extensions ?? '')}`.toLowerCase() : '';
    return /authenticat|does not have access|authoriz|unauthor|permission|forbidden|invalid.*token|token.*invalid/.test(text);
  });

type Failure = Exclude<UsageResponse, { state: 'ok' }>;
type Account = { ok: true; account: Record<string, unknown> } | { ok: false; failure: Failure };

// The one place that sends a query to Cloudflare and reduces every way it can go wrong to a UsageResponse state:
// a missing token or account id (nothing is sent), a refused token, an unreachable or unexpected answer.
async function queryAccount(
  env: UsageEnv,
  query: string,
  variables: (account: string) => Record<string, string>,
  fetchFn: FetchLike,
): Promise<Account> {
  const token = env.CLOUDFLARE_API_TOKEN?.trim();
  const account = env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const missing: UsageSecret[] = [];
  if (!token) missing.push('CLOUDFLARE_API_TOKEN');
  if (!account) missing.push('CLOUDFLARE_ACCOUNT_ID');
  if (!token || !account) return { ok: false, failure: { state: 'not-configured', missing } };

  let response: Response;
  try {
    response = await fetchFn(GRAPHQL_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: variables(account) }),
    });
  } catch {
    return { ok: false, failure: { state: 'unavailable' } };
  }
  if (response.status === 401 || response.status === 403) return { ok: false, failure: { state: 'denied' } };
  if (!response.ok) return { ok: false, failure: { state: 'unavailable' } };

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, failure: { state: 'unavailable' } };
  }
  if (!isRecord(payload)) return { ok: false, failure: { state: 'unavailable' } };
  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    return { ok: false, failure: isAuthError(payload.errors) ? { state: 'denied' } : { state: 'unavailable' } };
  }
  const viewer = isRecord(payload.data) && isRecord(payload.data.viewer) ? payload.data.viewer : undefined;
  const accounts = viewer && Array.isArray(viewer.accounts) ? viewer.accounts : undefined;
  const first = accounts?.[0];
  return isRecord(first) ? { ok: true, account: first } : { ok: false, failure: { state: 'unavailable' } };
}

export async function readCloudflareUsage(
  env: UsageEnv,
  days: UsageWindow,
  now: Date = new Date(),
  fetchFn: FetchLike = fetch,
): Promise<UsageResponse> {
  const dates = usageDates(days, now);
  const from = dates[0];
  const to = dates[dates.length - 1];
  const result = await queryAccount(env, USAGE_QUERY, (account) => ({ account, from, to, fromTime: `${from}T00:00:00Z`, toTime: now.toISOString() }), fetchFn);
  if (!result.ok) return result.failure;
  const rows = readRows(result.account);
  if (!rows) return { state: 'unavailable' };
  return { state: 'ok', days, readAt: now.toISOString(), history: fillUsageDays(days, now, rows) };
}

// specs/070-admin-dashboard-graphiques (research.md R1): today's consumption hour by hour, for the dashboard's curve.
// A query of its own, so that a refusal of the hourly breakdown (D1's `datetimeHour` is to be confirmed with the real
// token, quickstart step 1) can never break the history above. The filter is the UTC day so far.
export const TODAY_QUERY = `query Today($account: String!, $fromTime: Time!, $toTime: Time!) {
  viewer {
    accounts(filter: { accountTag: $account }) {
      workers: workersInvocationsAdaptive(limit: 10000, filter: { datetime_geq: $fromTime, datetime_leq: $toTime }) {
        sum { requests }
        dimensions { datetimeHour }
      }
      d1: d1AnalyticsAdaptiveGroups(limit: 1000, filter: { datetime_geq: $fromTime, datetime_leq: $toTime }) {
        sum { rowsRead rowsWritten }
        dimensions { datetimeHour }
      }
    }
  }
}`;

// Rows of both datasets → one UsageHour per row of the given UTC day (they are summed per hour by fillTodayHours).
function readHourRows(account: Record<string, unknown>, date: string): UsageHour[] | undefined {
  const workers = groups(account.workers);
  const d1 = groups(account.d1);
  if (!workers || !d1) return undefined;
  const rows: UsageHour[] = [];
  for (const [list, isWorkers] of [[workers, true], [d1, false]] as const) {
    for (const group of list) {
      const stamp = isRecord(group.dimensions) ? group.dimensions.datetimeHour : undefined;
      if (typeof stamp !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}/.test(stamp)) return undefined;
      if (stamp.slice(0, 10) !== date) continue;
      const sum = isRecord(group.sum) ? group.sum : {};
      rows.push({
        hour: Number(stamp.slice(11, 13)),
        workersRequests: isWorkers ? count(sum.requests) : 0,
        d1RowsRead: isWorkers ? 0 : count(sum.rowsRead),
        d1RowsWritten: isWorkers ? 0 : count(sum.rowsWritten),
      });
    }
  }
  return rows;
}

export async function readTodayUsage(env: UsageEnv, now: Date = new Date(), fetchFn: FetchLike = fetch): Promise<TodayUsageResponse> {
  const date = now.toISOString().slice(0, 10);
  const result = await queryAccount(env, TODAY_QUERY, (account) => ({ account, fromTime: `${date}T00:00:00Z`, toTime: now.toISOString() }), fetchFn);
  if (!result.ok) return result.failure;
  const rows = readHourRows(result.account, date);
  if (!rows) return { state: 'unavailable' };
  return { state: 'ok', date, readAt: now.toISOString(), hours: fillTodayHours(now, rows) };
}
