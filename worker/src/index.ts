import { purgeExpiredContributions, retentionCutoff } from './retention';
import { purgeStaleExternalPrices, refreshHuzounetPrices, syncHuzounetPrices } from './huzounet';
import { readPlayerCounters } from './player-counters';
import { communityPricesResponse, fetchCurrentMedian, insertContribution, MAX_AMOUNT_KAMAS, parseContributionPayload } from './contribution';
import { itemPricesResponse, latestPriceResponse } from './latest';
import { lotPricesResponse } from './lot-prices';
import { coefficientsResponse, insertClears, insertCoefficients, parseClearPayload, parseCoefficientPayload, purgeExpiredCoefficients } from './brisage-coefficients';
import { readExternalPrices, withExternalPrice } from './external-price';
import { infoMessageResponse } from './info-message';
import { priceHistoryResponse } from './price-history';
import { siteSettingsResponse } from './site-settings';
import { cachedRead, clearReadCache } from './read-cache';
import { CORS_HEADERS } from './cors';
import { handleFm } from './fm/router';
import { handleSniffer } from './sniffer';

export interface Env {
  DB: D1Database;
  COMMUNITY_API_KEY: string;
  // Optional so local runs without the binding keep working (see wrangler.toml [[ratelimits]]).
  CONTRIBUTION_LIMITER?: RateLimit;
  // specs/025-rune-purchase-import: the Forgemagie page's secrets and site URL (wrangler.toml).
  DISCORD_CLIENT_ID?: string;
  DISCORD_CLIENT_SECRET?: string;
  DISCORD_GUILD_ID?: string;
  FM_BOT_API_KEY?: string;
  SITE_URL?: string;
  // specs/045-restore-production-worker: "1" turns the reading of Huzounet's prices on (wrangler.toml).
  HUZOUNET_SYNC?: string;
  // specs/056-sniffer-batch-prices: what GET /sniffer/config tells the friends' tool (wrangler.toml).
  SNIFFER_MIN_VERSION?: string;
  SNIFFER_DOWNLOAD_URL?: string;
}

// The weekly retention's cron (wrangler.toml); any other trigger is the reading of Huzounet's prices.
const RETENTION_CRON = '0 3 * * MON';

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

  const external = (await readExternalPrices(env.DB, serverId, [resourceId])).get(resourceId);
  const median = withExternalPrice(await fetchCurrentMedian(env.DB, resourceId, serverId), external);
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
      // specs/025-rune-purchase-import: the origin of that latest price (contracts/fm-site-api.md).
      latestOrigin: median.latestOrigin,
      // specs/035: for a price read from Huzounet, whether its source calls it provisional or old.
      latestFragile: median.latestFragile,
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

    // specs/059-prix-par-lot: the last price seen for each lot size (1, 10, 100, 1000), for the pet XP page.
    if (request.method === 'GET' && url.pathname === '/community-lot-prices') {
      return cachedJson(url, () => lotPricesResponse(env.DB, url));
    }

    // specs/069-coefficients-brisage-partages: the latest breaking coefficient noted for each item.
    if (request.method === 'GET' && url.pathname === '/brisage-coefficients') {
      return cachedJson(url, () => coefficientsResponse(env.DB, url));
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

    // specs/050-forgemagie-page-toggle: the owner's site settings, readable by everyone.
    if (request.method === 'GET' && url.pathname === '/site-settings') {
      return json(await siteSettingsResponse(env.DB), 200, { 'Cache-Control': 'no-store' });
    }

    // specs/014-admin-counters: the humorous player counters, readable by everyone.
    if (request.method === 'GET' && url.pathname === '/player-counters') {
      return json(await readPlayerCounters(env.DB));
    }

    // specs/025-rune-purchase-import: the Forgemagie routes authenticate on their own (the bot's key or
    // the site's session token), so they are routed before the shared app key check below.
    if (url.pathname.startsWith('/fm/')) return handleFm(request, url, env);

    // specs/056-sniffer-batch-prices: the friends' HDV price tool authenticates with its own key
    // (sniffer_keys), so its routes are also routed before the shared app key check below.
    const sniffer = await handleSniffer(request, url, env);
    if (sniffer) {
      // specs/021 (FR-013): this isolate's cached reads no longer reflect the database.
      if (sniffer.wrote) clearReadCache();
      return json(sniffer.body, sniffer.status, { 'Cache-Control': 'no-store' });
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

    // specs/069-coefficients-brisage-partages: any player notes (or imports) breaking coefficients, with the
    // same app key and per-IP limiter as the price contributions; no player identity is stored.
    if (request.method === 'POST' && url.pathname === '/brisage-coefficients') {
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      if (env.CONTRIBUTION_LIMITER && !(await env.CONTRIBUTION_LIMITER.limit({ key: ip })).success) {
        return json({ error: 'Too many contributions, try again in a minute' }, 429);
      }
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Invalid JSON body' }, 400);
      }
      const payload = parseCoefficientPayload(body);
      if (!payload) return json({ error: 'deviceId and 1 to 100 entries (serverId, itemId, coefficient in ]0, 4000], optional notedAt within the last 90 days) are required' }, 400);
      await insertCoefficients(env.DB, payload);
      clearReadCache();
      return json({ stored: payload.entries.length }, 201);
    }

    // « The coefficient of this item is unknown »: hides the notes made before it (same key and limiter as above).
    if (request.method === 'POST' && url.pathname === '/brisage-coefficients/clear') {
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      if (env.CONTRIBUTION_LIMITER && !(await env.CONTRIBUTION_LIMITER.limit({ key: ip })).success) {
        return json({ error: 'Too many contributions, try again in a minute' }, 429);
      }
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Invalid JSON body' }, 400);
      }
      const payload = parseClearPayload(body);
      if (!payload) return json({ error: 'deviceId and 1 to 100 entries (serverId, itemId) are required' }, 400);
      await insertClears(env.DB, payload);
      clearReadCache();
      return json({ cleared: payload.entries.length }, 201);
    }

    // specs/045-restore-production-worker: a player asks for a recipe's prices to be read again now.
    if (request.method === 'POST' && url.pathname === '/external-prices/refresh') {
      if (env.HUZOUNET_SYNC !== '1') return json({ error: 'disabled' }, 503);
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      if (env.CONTRIBUTION_LIMITER && !(await env.CONTRIBUTION_LIMITER.limit({ key: ip })).success) {
        return json({ error: 'too-soon' }, 429);
      }
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Invalid JSON body' }, 400);
      }
      const record = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
      const result = await refreshHuzounetPrices(env.DB, typeof record.serverId === 'string' ? record.serverId : '', record.ids, {
        itemId: typeof record.itemId === 'string' ? record.itemId : undefined,
        // specs/046-hdv-huzounet-load: a request of the HDV page names its tab, and says when it is the last.
        hdv: typeof record.tab === 'string' ? { tab: record.tab, last: record.last === true } : undefined,
      });
      if (result.status === 'ok') {
        if (result.refreshed > 0) clearReadCache();
        // The HDV page also learns whether Huzounet was read at all: when it was not, it need not wait
        // before its next request.
        return json(typeof record.tab === 'string' ? { refreshed: result.refreshed, requests: result.requests } : { refreshed: result.refreshed });
      }
      if (result.status === 'hourly-limit') return json({ error: 'hourly-limit', retryAt: result.retryAt }, 429);
      const status = { invalid: 400, 'unknown-server': 404, 'too-soon': 429, unavailable: 502 }[result.status];
      return json({ error: result.status }, status);
    }

    if (request.method === 'POST' && url.pathname === '/visit') {
      return handlePostVisit(request, env);
    }

    return json({ error: 'Not found' }, 404);
  },

  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    if (controller.cron === RETENTION_CRON) {
      const removed = await purgeExpiredContributions(env.DB);
      console.log(`Retention: ${removed} contribution(s) older than 90 days removed (latest item prices kept)`);
      await purgeStaleExternalPrices(env.DB, retentionCutoff());
      // specs/069: the same 90 days for the shared breaking coefficients.
      console.log(`Retention: ${await purgeExpiredCoefficients(env.DB)} brisage coefficient(s) older than 90 days removed`);
      return;
    }
    if (env.HUZOUNET_SYNC !== '1') return;
    const result = await syncHuzounetPrices(env.DB);
    if (result.written > 0) clearReadCache();
    if (result.requests > 0 || result.error) {
      console.log(`Huzounet: ${result.requests} request(s), ${result.written} price(s) written, ${result.removed} removed${result.error ? `, stopped: ${result.error}` : ''}`);
    }
  },
};
