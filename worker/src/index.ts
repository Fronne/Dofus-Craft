import { summarizeContributions } from './median';
import { resolveOutlierFields } from './outlier';

export interface Env {
  DB: D1Database;
  COMMUNITY_API_KEY: string;
  // Optional so local runs without the binding keep working (see wrangler.toml [[ratelimits]]).
  CONTRIBUTION_LIMITER?: RateLimit;
}

// Upper bound for a single contribution: the in-game kamas cap. Anything above can only be a typo
// or an abusive request, and would never be a real price.
const MAX_AMOUNT_KAMAS = 2_000_000_000;

// 90 rolling days (FR-013).
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function isAuthorized(request: Request, env: Env): boolean {
  const header = request.headers.get('Authorization') ?? '';
  return header === `Bearer ${env.COMMUNITY_API_KEY}`;
}

// specs/007-outlier-confirmation: extracted so handlePostContribution can independently compute
// the median just before inserting a new contribution (FR-009), reusing the exact same query and
// aggregation as a plain read — never a separately-maintained calculation.
async function fetchCurrentMedian(
  env: Env,
  resourceId: string,
  serverId: string,
): Promise<{ medianAmountKamas: number; sampleSize: number; lastContributionAt: string } | undefined> {
  const since = new Date(Date.now() - RETENTION_MS).toISOString();
  const { results } = await env.DB.prepare(
    `SELECT amount_kamas, created_at, device_id FROM community_price_contributions
     WHERE resource_id = ? AND server_id = ? AND created_at >= ?`,
  ).bind(resourceId, serverId, since).all<{ amount_kamas: number; created_at: string; device_id: string }>();

  return summarizeContributions(results.map((row) => ({
    amountKamas: row.amount_kamas,
    createdAt: row.created_at,
    deviceId: row.device_id,
  })));
}

async function handleGetCommunityPrice(url: URL, env: Env): Promise<Response> {
  const resourceId = url.searchParams.get('resourceId');
  const serverId = url.searchParams.get('serverId');
  if (!resourceId || !serverId) return json({ error: 'resourceId and serverId are required' }, 400);

  const median = await fetchCurrentMedian(env, resourceId, serverId);
  // FR-002: no row at all — never a fabricated price — when nothing (or nothing valid after
  // FR-012's outlier filtering) remains.
  if (!median) return json(null, 404);

  return json({
    resourceId,
    serverId,
    medianAmountKamas: median.medianAmountKamas,
    sampleSize: median.sampleSize,
    lastContributionAt: median.lastContributionAt,
  });
}

type ContributionPayload = { resourceId: string; serverId: string; amountKamas: number; deviceId: string };

function isContributionPayload(value: unknown): value is ContributionPayload {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.resourceId === 'string' &&
    typeof record.serverId === 'string' &&
    typeof record.amountKamas === 'number' &&
    record.amountKamas >= 0 &&
    record.amountKamas <= MAX_AMOUNT_KAMAS &&
    typeof record.deviceId === 'string' &&
    record.deviceId.length > 0;
}

async function handlePostContribution(request: Request, env: Env): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  if (!isContributionPayload(body)) {
    return json({ error: `resourceId, serverId and an amountKamas between 0 and ${MAX_AMOUNT_KAMAS} are required` }, 400);
  }
  const { resourceId, serverId, amountKamas, deviceId } = body;

  // FR-010 (revision 5): no player-identifying data (name, account, IP) is ever persisted. deviceId
  // is an anonymous, client-generated identifier that only lets contributions from the same device
  // be recognized as such — never a player identity.
  // specs/007-outlier-confirmation, FR-009: independently (never trusting the client) resolve the
  // median this contribution is being compared against, and the resulting deviation, before the
  // insert — this is what makes the outlier trace (deviation_percent > 25) queryable later, without
  // affecting the median computation itself (FR-010).
  const currentMedian = await fetchCurrentMedian(env, resourceId, serverId);
  const { medianAtSubmissionKamas, deviationPercent } = resolveOutlierFields(amountKamas, currentMedian);

  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO community_price_contributions (id, resource_id, server_id, amount_kamas, device_id, median_at_submission_kamas, deviation_percent) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, resourceId, serverId, Math.round(amountKamas), deviceId, medianAtSubmissionKamas, deviationPercent).run();

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
      return handleGetCommunityPrice(url, env);
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
};
