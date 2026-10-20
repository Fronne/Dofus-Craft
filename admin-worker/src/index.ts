import { isUsageWindow } from '../../src/domain/cloudflare-usage';
import { readCloudflareUsage, type FetchLike, type UsageEnv } from './cloudflare-usage';
import { validateCounterInput } from '../../src/domain/player-counter';
import { verifyAccessToken, verifyOwner, type AccessEnv, type TokenVerifier } from './access';
import { createCounter, deleteCounter, listCounters, updateCounter, type CountersDb } from './counters';
import { deleteMessage, getMessage, saveMessage, type MessageDb } from './message';
import { validateInfoMessageInput } from '../../src/domain/info-message';
import { getSettings, saveSettings, type SettingsDb } from './settings';
import { createKey, listKeys, revokeKey, validateKeyLabel, type SnifferKeysDb } from './sniffer-keys';
import { activateMapping, listMappings, uploadMapping, validateMappingUpload, type SnifferMappingsDb } from './sniffer-mappings';
import { validateSiteSettingsChange } from '../../src/domain/site-settings';

// specs/014-admin-counters (contracts/player-counters-api.md): the administration page (static
// assets from dist-admin/) and its API. Every /api/* request goes through verifyOwner first.
export interface Env extends AccessEnv, UsageEnv {
  DB: CountersDb & MessageDb & SettingsDb & SnifferKeysDb & SnifferMappingsDb;
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

export async function handleApi(
  request: Request,
  env: Env,
  verify: TokenVerifier = verifyAccessToken,
  fetchFn: FetchLike = fetch,
): Promise<Response> {
  const owner = await verifyOwner(request, env, verify);
  if (!owner.ok) return json({ error: 'Accès réservé au propriétaire.' }, 403);

  const { pathname } = new URL(request.url);
  const counterId = pathname.match(/^\/api\/counters\/([^/]+)$/)?.[1];

  if (request.method === 'GET' && pathname === '/api/me') return json({ email: owner.email });
  // specs/058-admin-cloudflare-usage (contracts/admin-usage-api.md): today's consumption and history.
  // Always 200 with a `state`, so a missing token is a normal case for the page, not a failed call.
  if (request.method === 'GET' && pathname === '/api/usage') {
    const raw = new URL(request.url).searchParams.get('days');
    const days = raw === null ? 7 : Number(raw);
    if (!isUsageWindow(days)) return json({ error: 'La période doit être de 7 ou 30 jours.', field: 'days' }, 400);
    return json(await readCloudflareUsage(env, days, new Date(), fetchFn));
  }
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

  // specs/050-forgemagie-page-toggle: the site settings (which pages are enabled).
  if (pathname === '/api/settings') {
    if (request.method === 'GET') return json(await getSettings(env.DB));
    if (request.method === 'PUT') {
      const validation = validateSiteSettingsChange(await readBody(request));
      if (!validation.ok) return json({ error: validation.error, field: validation.field }, 400);
      return json(await saveSettings(env.DB, validation.value));
    }
  }

  // specs/057-sniffer-admin (contracts/admin-sniffer-api.md): the friends' HDV price tool — their keys
  // and the decoding mapping served per client build.
  if (pathname === '/api/sniffer/keys') {
    if (request.method === 'GET') return json(await listKeys(env.DB));
    if (request.method === 'POST') {
      const validation = validateKeyLabel(await readBody(request));
      if (!validation.ok) return json({ error: validation.error, field: validation.field }, 400);
      // The key itself is in this answer only: never stored, never readable again.
      return json(await createKey(env.DB, validation.value), 201);
    }
  }
  const revokedKeyId = pathname.match(/^\/api\/sniffer\/keys\/([^/]+)\/revoke$/)?.[1];
  if (request.method === 'POST' && revokedKeyId) {
    const revoked = await revokeKey(env.DB, decodeURIComponent(revokedKeyId));
    return revoked ? json(revoked) : json({ error: 'Clé introuvable.' }, 404);
  }
  if (pathname === '/api/sniffer/mappings') {
    if (request.method === 'GET') return json(await listMappings(env.DB));
    if (request.method === 'POST') {
      const validation = validateMappingUpload(await readBody(request));
      if (!validation.ok) return json({ error: validation.error, field: validation.field }, 400);
      return json(await uploadMapping(env.DB, validation.value), 201);
    }
  }
  const activatedMappingId = pathname.match(/^\/api\/sniffer\/mappings\/(\d+)\/activate$/)?.[1];
  if (request.method === 'POST' && activatedMappingId) {
    const activated = await activateMapping(env.DB, Number(activatedMappingId));
    return activated ? json(activated) : json({ error: 'Mapping introuvable.' }, 404);
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
