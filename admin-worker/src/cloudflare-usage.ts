import {
  fillUsageDays,
  usageDates,
  type UsageDay,
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

export async function readCloudflareUsage(
  env: UsageEnv,
  days: UsageWindow,
  now: Date = new Date(),
  fetchFn: FetchLike = fetch,
): Promise<UsageResponse> {
  const token = env.CLOUDFLARE_API_TOKEN?.trim();
  const account = env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const missing: UsageSecret[] = [];
  if (!token) missing.push('CLOUDFLARE_API_TOKEN');
  if (!account) missing.push('CLOUDFLARE_ACCOUNT_ID');
  if (!token || !account) return { state: 'not-configured', missing };

  const dates = usageDates(days, now);
  const from = dates[0];
  const to = dates[dates.length - 1];
  let response: Response;
  try {
    response = await fetchFn(GRAPHQL_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: USAGE_QUERY,
        variables: { account, from, to, fromTime: `${from}T00:00:00Z`, toTime: now.toISOString() },
      }),
    });
  } catch {
    return { state: 'unavailable' };
  }
  if (response.status === 401 || response.status === 403) return { state: 'denied' };
  if (!response.ok) return { state: 'unavailable' };

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { state: 'unavailable' };
  }
  if (!isRecord(payload)) return { state: 'unavailable' };
  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    return isAuthError(payload.errors) ? { state: 'denied' } : { state: 'unavailable' };
  }
  const viewer = isRecord(payload.data) && isRecord(payload.data.viewer) ? payload.data.viewer : undefined;
  const accounts = viewer && Array.isArray(viewer.accounts) ? viewer.accounts : undefined;
  const first = accounts?.[0];
  const rows = isRecord(first) ? readRows(first) : undefined;
  if (!rows) return { state: 'unavailable' };
  return { state: 'ok', days, readAt: now.toISOString(), history: fillUsageDays(days, now, rows) };
}
