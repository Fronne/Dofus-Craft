import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleApi, type Env } from '../../admin-worker/src/index';
import { GRAPHQL_URL, TODAY_QUERY } from '../../admin-worker/src/cloudflare-usage';
import {
  cumulativeHours,
  crossingText,
  fillTodayHours,
  parseTodayUsageResponse,
  thresholdCrossings,
  type TodayUsageResponse,
  type UsageHour,
} from '../../src/domain/cloudflare-usage';
import { createTestD1 } from '../support/sqlite-d1';

// specs/070-admin-dashboard-graphiques (data-model.md « Journée Cloudflare », contracts/admin-dashboard-api.md).
const NOW = new Date('2026-10-22T14:37:05.000Z');
const TOKEN = 'secret-token-value';

const hour = (h: number, workersRequests = 0, d1RowsRead = 0, d1RowsWritten = 0): UsageHour => ({ hour: h, workersRequests, d1RowsRead, d1RowsWritten });

describe('fillTodayHours', () => {
  it('lists every hour from 0 to the current one, the missing ones at 0', () => {
    const hours = fillTodayHours(NOW, [hour(3, 10), hour(14, 5, 7, 1)]);
    expect(hours).toHaveLength(15);
    expect(hours[0]).toEqual(hour(0));
    expect(hours[3]).toEqual(hour(3, 10));
    expect(hours[14]).toEqual(hour(14, 5, 7, 1));
  });

  it('adds rows of the same hour and ignores hours that are not of the day so far', () => {
    const hours = fillTodayHours(NOW, [hour(2, 10), hour(2, 0, 500, 7), hour(15, 99, 99, 99), hour(-1, 9), { ...hour(0), hour: 1.5, workersRequests: 9 }]);
    expect(hours[2]).toEqual(hour(2, 10, 500, 7));
    expect(hours).toHaveLength(15);
    expect(hours.reduce((sum, entry) => sum + entry.workersRequests, 0)).toBe(10);
  });

  it('starts over at midnight UTC: one empty hour, nothing from the day before', () => {
    expect(fillTodayHours(new Date('2026-10-22T00:04:00Z'), [])).toEqual([hour(0)]);
  });
});

describe('cumulativeHours', () => {
  it('adds the hours up and gives each total as a percentage of its limit, never capped', () => {
    const cumulative = cumulativeHours([hour(0, 50_000), hour(1, 62_000, 0, 10_000), hour(2)]);
    expect(cumulative.map((entry) => entry.used.workersRequests)).toEqual([50_000, 112_000, 112_000]);
    expect(cumulative.map((entry) => entry.percent.workersRequests)).toEqual([50, 112, 112]);
    expect(cumulative[1].percent.d1RowsWritten).toBe(10);
  });

  it('marks only the last hour, the one still running, as partial', () => {
    const cumulative = cumulativeHours([hour(0), hour(1), hour(2)]);
    expect(cumulative.map((entry) => entry.partial)).toEqual([false, false, true]);
  });

  it('keeps an hour without consumption at the previous level instead of dropping it', () => {
    const cumulative = cumulativeHours([hour(0, 100), hour(1), hour(2, 50)]);
    expect(cumulative.map((entry) => entry.used.workersRequests)).toEqual([100, 100, 150]);
  });

  it('is empty for no hour', () => {
    expect(cumulativeHours([])).toEqual([]);
  });
});

describe('thresholdCrossings', () => {
  it('finds the first hour a limit reached 80 % and the first it reached 100 %', () => {
    const cumulative = cumulativeHours([hour(0, 70_000), hour(1, 10_000), hour(2, 10_000), hour(3, 20_000)]);
    const crossings = thresholdCrossings(cumulative);
    expect(crossings).toContainEqual({ metric: 'workersRequests', level: 'warning', hour: 1 });
    expect(crossings).toContainEqual({ metric: 'workersRequests', level: 'over', hour: 3 });
    expect(crossings.filter((crossing) => crossing.metric !== 'workersRequests')).toEqual([]);
  });

  it('reports both levels on the same hour when one hour jumps over the limit', () => {
    const crossings = thresholdCrossings(cumulativeHours([hour(0), hour(1, 0, 0, 120_000)]));
    expect(crossings).toEqual([
      { metric: 'd1RowsWritten', level: 'warning', hour: 1 },
      { metric: 'd1RowsWritten', level: 'over', hour: 1 },
    ]);
  });

  it('reports nothing below 80 %, and exactly 80 % counts', () => {
    expect(thresholdCrossings(cumulativeHours([hour(0, 79_999)]))).toEqual([]);
    expect(thresholdCrossings(cumulativeHours([hour(0, 80_000)]))).toEqual([{ metric: 'workersRequests', level: 'warning', hour: 0 }]);
  });

  it('writes a crossing as a sentence, so the chart does not rely on colour', () => {
    expect(crossingText({ metric: 'd1RowsWritten', level: 'warning', hour: 14 })).toBe('Écritures de lignes D1 : 80 % franchi à 14 h UTC');
    expect(crossingText({ metric: 'workersRequests', level: 'over', hour: 3 })).toBe('Requêtes Workers : 100 % franchi à 3 h UTC');
  });
});

describe('parseTodayUsageResponse', () => {
  it('accepts every state and refuses anything else', () => {
    const ok: TodayUsageResponse = { state: 'ok', date: '2026-10-22', readAt: 'x', hours: [hour(0, 1)] };
    expect(parseTodayUsageResponse(ok)).toEqual(ok);
    expect(parseTodayUsageResponse({ state: 'denied' })).toEqual({ state: 'denied' });
    expect(parseTodayUsageResponse({ state: 'unavailable' })).toEqual({ state: 'unavailable' });
    expect(parseTodayUsageResponse({ state: 'not-configured', missing: ['CLOUDFLARE_API_TOKEN'] })).toEqual({
      state: 'not-configured',
      missing: ['CLOUDFLARE_API_TOKEN'],
    });
    expect(parseTodayUsageResponse({ state: 'ok', date: 'd', readAt: 'x', hours: [{ hour: 24, workersRequests: 0, d1RowsRead: 0, d1RowsWritten: 0 }] })).toBeUndefined();
    expect(parseTodayUsageResponse({ state: 'ok', date: 'd', readAt: 'x', hours: [{ hour: 1 }] })).toBeUndefined();
    expect(parseTodayUsageResponse({ state: 'ok', readAt: 'x', hours: [] })).toBeUndefined();
    expect(parseTodayUsageResponse({ state: 'ok', days: 7, readAt: 'x', history: [] })).toBeUndefined();
    expect(parseTodayUsageResponse({ state: 'other' })).toBeUndefined();
    expect(parseTodayUsageResponse(null)).toBeUndefined();
  });
});

const owner = vi.fn().mockResolvedValue({ email: 'owner@example.com' });
const stranger = vi.fn().mockResolvedValue({ email: 'someone@else.com' });

let env: Env;

const analytics = (account: unknown) => new Response(JSON.stringify({ data: { viewer: { accounts: [account] } }, errors: null }), { status: 200 });
const nominal = () =>
  analytics({
    workers: [
      { sum: { requests: 1200 }, dimensions: { datetimeHour: '2026-10-22T09:00:00Z' } },
      { sum: { requests: 34 }, dimensions: { datetimeHour: '2026-10-22T14:00:00Z' } },
      { sum: { requests: 99_999 }, dimensions: { datetimeHour: '2026-10-21T23:00:00Z' } },
    ],
    d1: [{ sum: { rowsRead: 4000, rowsWritten: 21 }, dimensions: { datetimeHour: '2026-10-22T09:00:00Z' } }],
  });

function call(path: string, fetchFn: ReturnType<typeof vi.fn>, verify = owner) {
  const request = new Request(`https://dofus-craft-admin.example.workers.dev${path}`, { headers: { 'Cf-Access-Jwt-Assertion': 'jwt' } });
  return handleApi(request, env, verify, fetchFn);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  env = {
    DB: createTestD1().d1 as unknown as Env['DB'],
    ASSETS: { fetch: vi.fn() },
    TEAM_DOMAIN: 'https://dofus.cloudflareaccess.com',
    POLICY_AUD: 'aud',
    OWNER_EMAIL: 'owner@example.com',
    CLOUDFLARE_API_TOKEN: TOKEN,
    CLOUDFLARE_ACCOUNT_ID: 'account-123',
  };
});

describe('GET /api/usage/today', () => {
  it('refuses anyone but the owner, without calling Cloudflare', async () => {
    const fetchFn = vi.fn();
    expect((await call('/api/usage/today', fetchFn, stranger)).status).toBe(403);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('reads the UTC day so far and returns one entry per hour up to the current one', async () => {
    const fetchFn = vi.fn().mockResolvedValue(nominal());
    const response = await call('/api/usage/today', fetchFn);
    expect(response.status).toBe(200);
    const body = (await response.json()) as Extract<TodayUsageResponse, { state: 'ok' }>;
    expect(body).toMatchObject({ state: 'ok', date: '2026-10-22', readAt: NOW.toISOString() });
    expect(body.hours).toHaveLength(15);
    expect(body.hours[9]).toEqual(hour(9, 1200, 4000, 21));
    expect(body.hours[14]).toEqual(hour(14, 34));
    expect(body.hours[0]).toEqual(hour(0));
    // The previous day's last hour is not part of today.
    expect(body.hours.reduce((sum, entry) => sum + entry.workersRequests, 0)).toBe(1234);

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(GRAPHQL_URL);
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
    const sent = JSON.parse(String(init.body)) as { query: string; variables: Record<string, string> };
    expect(sent.query).toBe(TODAY_QUERY);
    expect(sent.variables).toEqual({ account: 'account-123', fromTime: '2026-10-22T00:00:00Z', toTime: NOW.toISOString() });
  });

  it.each([
    ['both', { CLOUDFLARE_API_TOKEN: undefined, CLOUDFLARE_ACCOUNT_ID: undefined }, ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID']],
    ['the token', { CLOUDFLARE_API_TOKEN: '  ' }, ['CLOUDFLARE_API_TOKEN']],
  ])('answers "not configured" when %s is missing, without calling Cloudflare', async (_name, patch, missing) => {
    Object.assign(env, patch);
    const fetchFn = vi.fn();
    const response = await call('/api/usage/today', fetchFn);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ state: 'not-configured', missing });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it.each([
    ['HTTP 401', () => new Response('{}', { status: 401 })],
    ['a GraphQL access error', () => new Response(JSON.stringify({ data: null, errors: [{ message: 'does not have access to the path' }] }))],
  ])('answers "denied" on %s', async (_name, reply) => {
    expect(await (await call('/api/usage/today', vi.fn().mockResolvedValue(reply()))).json()).toEqual({ state: 'denied' });
  });

  it.each([
    ['a network failure', () => vi.fn().mockRejectedValue(new Error(`boom ${TOKEN}`))],
    ['HTTP 500', () => vi.fn().mockResolvedValue(new Response('oops', { status: 500 }))],
    ['invalid JSON', () => vi.fn().mockResolvedValue(new Response('<html>', { status: 200 }))],
    ['a refused hourly breakdown', () => vi.fn().mockResolvedValue(new Response(JSON.stringify({ errors: [{ message: 'unknown field "datetimeHour"' }] })))],
    ['an unexpected shape', () => vi.fn().mockResolvedValue(analytics({ workers: 'x' }))],
    ['a row without an hour', () => vi.fn().mockResolvedValue(analytics({ workers: [{ sum: { requests: 1 }, dimensions: {} }], d1: [] }))],
    ['no account in the answer', () => vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { viewer: { accounts: [] } } })))],
  ])('answers "unavailable" on %s, never leaking the token', async (_name, makeFetch) => {
    const response = await call('/api/usage/today', makeFetch());
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ state: 'unavailable' });
    expect(text).not.toContain(TOKEN);
  });
});
