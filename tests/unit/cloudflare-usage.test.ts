import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleApi, type Env } from '../../admin-worker/src/index';
import { GRAPHQL_URL } from '../../admin-worker/src/cloudflare-usage';
import {
  fillUsageDays,
  parseUsageResponse,
  usageDates,
  usageLevel,
  usagePercent,
  type UsageDay,
} from '../../src/domain/cloudflare-usage';
import { createTestD1 } from '../support/sqlite-d1';

// specs/058-admin-cloudflare-usage (data-model.md, contracts/admin-usage-api.md).
const NOW = new Date('2026-10-19T14:03:11.000Z');
const TOKEN = 'secret-token-value';

describe('usagePercent / usageLevel', () => {
  it('rounds to the nearest percent and never caps', () => {
    expect(usagePercent(0, 100_000)).toBe(0);
    expect(usagePercent(50_000, 100_000)).toBe(50);
    expect(usagePercent(112_000, 100_000)).toBe(112);
    expect(usagePercent(1, 100_000)).toBe(0);
    expect(usagePercent(-5, 100_000)).toBe(0);
  });

  it('switches level at 80 % and 100 %', () => {
    expect(usageLevel(0, 100)).toBe('ok');
    expect(usageLevel(79, 100)).toBe('ok');
    expect(usageLevel(80, 100)).toBe('warning');
    expect(usageLevel(99, 100)).toBe('warning');
    expect(usageLevel(100, 100)).toBe('over');
    expect(usageLevel(250, 100)).toBe('over');
  });
});

describe('usageDates / fillUsageDays', () => {
  it('lists the UTC days ending today, oldest first, across a month change', () => {
    expect(usageDates(7, NOW)).toEqual(['2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19']);
    const thirty = usageDates(30, new Date('2026-11-02T00:00:00Z'));
    expect(thirty).toHaveLength(30);
    expect(thirty[0]).toBe('2026-10-04');
    expect(thirty[29]).toBe('2026-11-02');
  });

  it('fills missing days with 0, adds rows of the same date and ignores dates outside the window', () => {
    const rows: UsageDay[] = [
      { date: '2026-10-19', workersRequests: 10, d1RowsRead: 0, d1RowsWritten: 0 },
      { date: '2026-10-19', workersRequests: 0, d1RowsRead: 500, d1RowsWritten: 7 },
      { date: '2026-10-01', workersRequests: 99, d1RowsRead: 99, d1RowsWritten: 99 },
    ];
    const history = fillUsageDays(7, NOW, rows);
    expect(history).toHaveLength(7);
    expect(history[0]).toEqual({ date: '2026-10-13', workersRequests: 0, d1RowsRead: 0, d1RowsWritten: 0 });
    expect(history[6]).toEqual({ date: '2026-10-19', workersRequests: 10, d1RowsRead: 500, d1RowsWritten: 7 });
  });
});

describe('parseUsageResponse', () => {
  it('accepts every state and refuses anything else', () => {
    expect(parseUsageResponse({ state: 'denied' })).toEqual({ state: 'denied' });
    expect(parseUsageResponse({ state: 'unavailable' })).toEqual({ state: 'unavailable' });
    expect(parseUsageResponse({ state: 'not-configured', missing: ['CLOUDFLARE_API_TOKEN', 'x'] })).toEqual({
      state: 'not-configured',
      missing: ['CLOUDFLARE_API_TOKEN'],
    });
    expect(parseUsageResponse({ state: 'ok', days: 15, readAt: 'x', history: [] })).toBeUndefined();
    expect(parseUsageResponse({ state: 'ok', days: 7, readAt: 'x', history: [{ date: 'd' }] })).toBeUndefined();
    expect(parseUsageResponse({ state: 'other' })).toBeUndefined();
    expect(parseUsageResponse(null)).toBeUndefined();
  });
});

const owner = vi.fn().mockResolvedValue({ email: 'owner@example.com' });
const stranger = vi.fn().mockResolvedValue({ email: 'someone@else.com' });

let env: Env;

const analytics = (account: unknown) => new Response(JSON.stringify({ data: { viewer: { accounts: [account] } }, errors: null }), { status: 200 });
const nominal = () =>
  analytics({
    workers: [{ sum: { requests: 1234 }, dimensions: { date: '2026-10-19' } }],
    d1: [{ sum: { rowsRead: 4_000_000, rowsWritten: 321 }, dimensions: { date: '2026-10-18' } }],
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

describe('GET /api/usage', () => {
  it('refuses anyone but the owner, without calling Cloudflare', async () => {
    const fetchFn = vi.fn();
    expect((await call('/api/usage', fetchFn, stranger)).status).toBe(403);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('reads Cloudflare with the bearer token and returns a gap-free history', async () => {
    const fetchFn = vi.fn().mockResolvedValue(nominal());
    const response = await call('/api/usage', fetchFn);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { state: string; days: number; readAt: string; history: UsageDay[] };
    expect(body).toMatchObject({ state: 'ok', days: 7, readAt: NOW.toISOString() });
    expect(body.history).toHaveLength(7);
    expect(body.history[6]).toMatchObject({ date: '2026-10-19', workersRequests: 1234, d1RowsRead: 0 });
    expect(body.history[5]).toMatchObject({ date: '2026-10-18', d1RowsRead: 4_000_000, d1RowsWritten: 321 });
    expect(body.history[0]).toMatchObject({ date: '2026-10-13', workersRequests: 0 });

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(GRAPHQL_URL);
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
    const sent = JSON.parse(String(init.body)) as { variables: Record<string, string> };
    expect(sent.variables).toMatchObject({ account: 'account-123', from: '2026-10-13', to: '2026-10-19' });
  });

  it('asks for 30 days when told so', async () => {
    const fetchFn = vi.fn().mockResolvedValue(nominal());
    const body = (await (await call('/api/usage?days=30', fetchFn)).json()) as { history: UsageDay[] };
    expect(body.history).toHaveLength(30);
  });

  it('refuses a period other than 7 or 30 days', async () => {
    const fetchFn = vi.fn();
    const response = await call('/api/usage?days=15', fetchFn);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ field: 'days' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it.each([
    ['both', { CLOUDFLARE_API_TOKEN: undefined, CLOUDFLARE_ACCOUNT_ID: undefined }, ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID']],
    ['the token', { CLOUDFLARE_API_TOKEN: '  ' }, ['CLOUDFLARE_API_TOKEN']],
    ['the account', { CLOUDFLARE_ACCOUNT_ID: undefined }, ['CLOUDFLARE_ACCOUNT_ID']],
  ])('answers "not configured" when %s is missing, without calling Cloudflare', async (_name, patch, missing) => {
    Object.assign(env, patch);
    const fetchFn = vi.fn();
    const response = await call('/api/usage', fetchFn);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ state: 'not-configured', missing });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it.each([
    ['HTTP 401', () => new Response('{}', { status: 401 })],
    ['HTTP 403', () => new Response('{}', { status: 403 })],
    ['a GraphQL authentication error', () => new Response(JSON.stringify({ data: null, errors: [{ message: 'not authorized to access this field' }] }))],
  ])('answers "denied" on %s', async (_name, reply) => {
    expect(await (await call('/api/usage', vi.fn().mockResolvedValue(reply()))).json()).toEqual({ state: 'denied' });
  });

  it.each([
    ['a network failure', () => vi.fn().mockRejectedValue(new Error(`boom ${TOKEN}`))],
    ['HTTP 500', () => vi.fn().mockResolvedValue(new Response('oops', { status: 500 }))],
    ['invalid JSON', () => vi.fn().mockResolvedValue(new Response('<html>', { status: 200 }))],
    ['another GraphQL error', () => vi.fn().mockResolvedValue(new Response(JSON.stringify({ errors: [{ message: 'query too heavy' }] })))],
    ['an unexpected shape', () => vi.fn().mockResolvedValue(analytics({ workers: 'x' }))],
    ['no account in the answer', () => vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { viewer: { accounts: [] } } })))],
  ])('answers "unavailable" on %s, never leaking the token', async (_name, makeFetch) => {
    const response = await call('/api/usage', makeFetch());
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ state: 'unavailable' });
    expect(text).not.toContain(TOKEN);
  });
});
