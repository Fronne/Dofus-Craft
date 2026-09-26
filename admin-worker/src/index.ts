import { validateCounterInput } from '../../src/domain/player-counter';
import { verifyAccessToken, verifyOwner, type AccessEnv, type TokenVerifier } from './access';
import { createCounter, deleteCounter, listCounters, updateCounter, type CountersDb } from './counters';
import { deleteMessage, getMessage, saveMessage, type MessageDb } from './message';
import { validateInfoMessageInput } from '../../src/domain/info-message';

// specs/014-admin-counters (contracts/player-counters-api.md): the administration page (static
// assets from dist-admin/) and its API. Every /api/* request goes through verifyOwner first.
export interface Env extends AccessEnv {
  DB: CountersDb & MessageDb;
  ASSETS: { fetch(request: Request): Promise<Response> };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

async function readBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export async function handleApi(request: Request, env: Env, verify: TokenVerifier = verifyAccessToken): Promise<Response> {
  const owner = await verifyOwner(request, env, verify);
  if (!owner.ok) return json({ error: 'Accès réservé au propriétaire.' }, 403);

  const { pathname } = new URL(request.url);
  const counterId = pathname.match(/^\/api\/counters\/([^/]+)$/)?.[1];

  if (request.method === 'GET' && pathname === '/api/me') return json({ email: owner.email });
  // specs/020-info-banner: the information banner's message. GET returns it even once expired, so
  // the editor can show it and say so.
  if (pathname === '/api/message') {
    if (request.method === 'GET') return json(await getMessage(env.DB));
    if (request.method === 'PUT') {
      const validation = validateInfoMessageInput(await readBody(request));
      if (!validation.ok) return json({ error: validation.error, field: validation.field }, 400);
      return json(await saveMessage(env.DB, validation.value));
    }
    if (request.method === 'DELETE') {
      await deleteMessage(env.DB);
      return new Response(null, { status: 204 });
    }
  }

  if (request.method === 'GET' && pathname === '/api/counters') return json(await listCounters(env.DB));

  if (request.method === 'POST' && pathname === '/api/counters') {
    const validation = validateCounterInput(await readBody(request), 'create');
    if (!validation.ok) return json({ error: validation.error, field: validation.field }, 400);
    return json(await createCounter(env.DB, validation.value), 201);
  }

  if (request.method === 'PATCH' && counterId) {
    const validation = validateCounterInput(await readBody(request), 'update');
    if (!validation.ok) return json({ error: validation.error, field: validation.field }, 400);
    const updated = await updateCounter(env.DB, decodeURIComponent(counterId), validation.value);
    return updated ? json(updated) : json({ error: 'Compteur introuvable.' }, 404);
  }

  if (request.method === 'DELETE' && counterId) {
    const deleted = await deleteCounter(env.DB, decodeURIComponent(counterId));
    return deleted ? new Response(null, { status: 204 }) : json({ error: 'Compteur introuvable.' }, 404);
  }

  return json({ error: 'Not found' }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith('/api/')) return handleApi(request, env);
    // The page itself: Cloudflare Access already required the owner's sign-in to get here.
    return env.ASSETS.fetch(request);
  },
};
