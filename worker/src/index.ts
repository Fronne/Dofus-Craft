import { computeCommunityMedian } from './median';

export interface Env {
  DB: D1Database;
  COMMUNITY_API_KEY: string;
}

// 90 rolling days (FR-011).
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
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

async function handleGetCommunityPrice(url: URL, env: Env): Promise<Response> {
  const resourceId = url.searchParams.get('resourceId');
  const serverId = url.searchParams.get('serverId');
  if (!resourceId || !serverId) return json({ error: 'resourceId and serverId are required' }, 400);

  const since = new Date(Date.now() - RETENTION_MS).toISOString();
  const { results } = await env.DB.prepare(
    `SELECT amount_kamas FROM community_price_contributions
     WHERE resource_id = ? AND server_id = ? AND created_at >= ?`,
  ).bind(resourceId, serverId, since).all<{ amount_kamas: number }>();

  const median = computeCommunityMedian(results.map((row) => row.amount_kamas));
  // FR-002: no row at all — never a fabricated price — when nothing (or nothing valid after
  // FR-010's outlier filtering) remains.
  if (!median) return json(null, 404);

  return json({
    resourceId,
    serverId,
    medianAmountKamas: median.medianAmountKamas,
    sampleSize: median.sampleSize,
  });
}

type ContributionPayload = { resourceId: string; serverId: string; amountKamas: number };

function isContributionPayload(value: unknown): value is ContributionPayload {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.resourceId === 'string' &&
    typeof record.serverId === 'string' &&
    typeof record.amountKamas === 'number' &&
    record.amountKamas >= 0;
}

async function handlePostContribution(request: Request, env: Env): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }
  if (!isContributionPayload(body)) {
    return json({ error: 'resourceId, serverId and a non-negative amountKamas are required' }, 400);
  }
  const { resourceId, serverId, amountKamas } = body;

  // FR-007: only resourceId/serverId/amountKamas are ever persisted — no player, device or IP
  // identifier exists anywhere in this schema or this handler.
  const id = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO community_price_contributions (id, resource_id, server_id, amount_kamas) VALUES (?, ?, ?, ?)`,
  ).bind(id, resourceId, serverId, Math.round(amountKamas)).run();

  return json({ id }, 201);
}

async function handleDeleteContribution(id: string, env: Env): Promise<Response> {
  // FR-012: knowing `id` is the only proof of ownership required; deleting an already-removed
  // (or never-existing) id is not an error — this stays idempotent by construction.
  await env.DB.prepare(`DELETE FROM community_price_contributions WHERE id = ?`).bind(id).run();
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });

    const url = new URL(request.url);

    // Reading a community price carries no consent requirement (US1 is available regardless of
    // ShareConsent) — anonymous read access is intentional and matches the client contract.
    if (request.method === 'GET' && url.pathname === '/community-price') {
      return handleGetCommunityPrice(url, env);
    }

    // Writes (contribute / withdraw) require the shared app key, a light deterrent against
    // requests from outside this app — never a player identity (FR-007 still holds: the key is
    // the same for every player, it identifies the app, not a person).
    if (!isAuthorized(request, env)) return json({ error: 'Unauthorized' }, 401);

    if (request.method === 'POST' && url.pathname === '/community-price') {
      return handlePostContribution(request, env);
    }

    const deleteMatch = /^\/community-price\/([^/]+)$/.exec(url.pathname);
    if (request.method === 'DELETE' && deleteMatch) {
      return handleDeleteContribution(deleteMatch[1], env);
    }

    return json({ error: 'Not found' }, 404);
  },
};
