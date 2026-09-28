import { purgeExpiredContributions } from './retention';
import { readPlayerCounters } from './player-counters';
import { communityPricesResponse, fetchCurrentMedian, insertContribution, MAX_AMOUNT_KAMAS, parseContributionPayload } from './contribution';
import { itemPricesResponse, latestPriceResponse } from './latest';
import { infoMessageResponse } from './info-message';
import { priceHistoryResponse } from './price-history';
import { cachedRead, clearReadCache } from './read-cache';

export interface Env {
  DB: D1Database;
  COMMUNITY_API_KEY: string;
  // Optional so local runs without the binding keep working (see wrangler.toml [[ratelimits]]).
  CONTRIBUTION_LIMITER?: RateLimit;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS, ...extraHeaders },
  });
}

function isAuthorized(request: Request, env: Env): boolean {
  const header = request.headers.get('Authorization') ?? '';
  return header === `Bearer ${env.COMMUNITY_API_KEY}`;
}

// specs/021-background-data-loading: price reads go through the 60-second read cache.
async function cachedJson(url: URL, read: () => Promise<{ status: number; body: unknown }>): Promise<Response> {
  const { status, body, headers } = await cachedRead(url, read);
  return json(body, status, headers);
}

async function communityPriceResponse(url: URL, env: Env): Promise<{ status: number; body: unknown }> {
  const resourceId = url.searchParams.get('resourceId');
  const serverId = url.searchParams.get('serverId');
  if (!resourceId || !serverId) return { status: 400, body: { error: 'resourceId and serverId are required' } };

  const median = await fetchCurrentMedian(env.DB, resourceId, serverId);
  // FR-002: no row at all — never a fabricated price — when nothing (or nothing valid after
  // FR-012's outlier filtering) remains.
  if (!median) return { status: 404, body: null };

  return {
    status: 200,
    body: {
      resourceId,
      serverId,
      medianAmountKamas: median.medianAmountKamas,
      sampleSize: median.sampleSize,
      lastContributionAt: median.lastContributionAt,
      // specs/024-latest-community-price: the price the site shows (contracts/community-price-api.md).
      latestAmountKamas: median.latestAmountKamas,
      latestContributionAt: median.latestContributionAt,
    },
  };
}

async function handlePostContribution(request: Request, env: Env): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  const contribution = parseContributionPayload(body);
  if (!contribution) {
    return json({ error: `resourceId, serverId, an amountKamas between 0 and ${MAX_AMOUNT_KAMAS} and an optional kind "item" are required` }, 400);
  }
  // FR-010 (revision 5): no player-identifying data (name, account, IP) is ever persisted; the
  // outlier trace is resolved server-side (specs/007 FR-009, specs/016 FR-012) — see contribution.ts.
  const id = await insertContribution(env.DB, contribution);
  // specs/021 (FR-013): this isolate's cached reads no longer reflect the database.
  clearReadCache();

  return json({ id }, 201);
}

type VisitPayload = { deviceId: string };

function isVisitPayload(value: unknown): value is VisitPayload {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.deviceId === 'string' && record.deviceId.length > 0;
}

// specs/006-anonymous-visit-count: anonymous daily presence signal, sent on every app load
// regardless of price mode (amends specs/004-community-price-sharing FR-015). The day is computed
// here, never trusted from the client, so it can't be skewed by a wrong device clock/timezone.
async function handlePostVisit(request: Request, env: Env): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  if (!isVisitPayload(body)) {
    return json({ error: 'deviceId is required' }, 400);
  }

  const day = new Date().toISOString().slice(0, 10);
  await env.DB.prepare(
    `INSERT OR IGNORE INTO app_visits (device_id, day) VALUES (?, ?)`,
  ).bind(body.deviceId, day).run();

  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

    const url = new URL(request.url);

    // Reading a community price never requires the write-side app key — anonymous read access is
    // intentional and matches the client contract.
    if (request.method === 'GET' && url.pathname === '/community-price') {
      return cachedJson(url, () => communityPriceResponse(url, env));
    }

    // specs/021-background-data-loading: several resources' medians in one request.
    if (request.method === 'GET' && url.pathname === '/community-prices') {
      return cachedJson(url, () => communityPricesResponse(env.DB, url));
    }

    // specs/016-shared-item-prices: an item's shared HDV price — its latest contribution, no median.
    if (request.method === 'GET' && url.pathname === '/latest-price') {
      return cachedJson(url, () => latestPriceResponse(env.DB, url));
    }

    // specs/019-craft-profit-list: every item's latest shared HDV price on a server, for the Prix page.
    if (request.method === 'GET' && url.pathname === '/item-prices') {
      return cachedJson(url, () => itemPricesResponse(env.DB, url));
    }

    // specs/017-price-history-chart: per-period medians only, never an individual contribution.
    if (request.method === 'GET' && url.pathname === '/price-history') {
      return cachedJson(url, () => priceHistoryResponse(env.DB, url));
    }

    // specs/020-info-banner: the information banner's message, readable by everyone.
    if (request.method === 'GET' && url.pathname === '/info-message') {
      const { status, body } = await infoMessageResponse(env.DB);
      return json(body, status);
    }

    // specs/014-admin-counters: the humorous player counters, readable by everyone.
    if (request.method === 'GET' && url.pathname === '/player-counters') {
      return json(await readPlayerCounters(env.DB));
    }

    // Writes (contribute) require the shared app key, a light deterrent against requests from
    // outside this app — never a player identity (FR-010 still holds: the key is the same for
    // every player, it identifies the app, not a person).
    if (!isAuthorized(request, env)) return json({ error: 'Unauthorized' }, 401);

    if (request.method === 'POST' && url.pathname === '/community-price') {
      // Throttles contributions per client IP. The IP is only used as the limiter's in-memory key,
      // never stored (FR-010): the API key is public in the app bundle, so this is what stops a
      // script from flooding the median.
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      if (env.CONTRIBUTION_LIMITER && !(await env.CONTRIBUTION_LIMITER.limit({ key: ip })).success) {
        return json({ error: 'Too many contributions, try again in a minute' }, 429);
      }
      return handlePostContribution(request, env);
    }

    if (request.method === 'POST' && url.pathname === '/visit') {
      return handlePostVisit(request, env);
    }

    return json({ error: 'Not found' }, 404);
  },

  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    const removed = await purgeExpiredContributions(env.DB);
    console.log(`Retention: ${removed} contribution(s) older than 90 days removed (latest item prices kept)`);
  },
};
