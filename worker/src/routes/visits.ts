import { CORS_HEADERS } from '../cors';
import { optionalViewer } from '../fm/http';
import { json } from '../http';
import type { Env } from '../index';

type VisitPayload = { deviceId: string };

export function isVisitPayload(value: unknown): value is VisitPayload {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.deviceId === 'string' && record.deviceId.length > 0;
}

// specs/006-anonymous-visit-count: anonymous daily presence signal, sent on every app load
// regardless of price mode (amends specs/004-community-price-sharing FR-015). The day is computed
// here, never trusted from the client, so it can't be skewed by a wrong device clock/timezone.
export async function handlePostVisit(request: Request, env: Env): Promise<Response> {
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
  // specs/082: a logged-in player's visit is linked to them (the admin dashboard names the day's visitors). Without a
  // valid session the visit stays anonymous, and an anonymous repeat never unlinks a visit already linked.
  const discordUserId = await optionalViewer(request, env.DB);
  await env.DB.prepare(
    `INSERT INTO app_visits (device_id, day, discord_user_id) VALUES (?, ?, ?)
     ON CONFLICT (device_id, day) DO UPDATE SET discord_user_id = excluded.discord_user_id WHERE excluded.discord_user_id IS NOT NULL`,
  ).bind(body.deviceId, day, discordUserId ?? null).run();

  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
