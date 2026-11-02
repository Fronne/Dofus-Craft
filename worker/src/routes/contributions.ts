import { insertContribution, MAX_AMOUNT_KAMAS, parseContributionPayload } from '../contribution';
import { optionalViewer } from '../fm/http';
import { json } from '../http';
import type { Env } from '../index';
import { clearReadCache } from '../read-cache';

export async function handlePostContribution(request: Request, env: Env): Promise<Response> {
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
  // specs/082-auteur-prix-communautaires: a logged-in player signs the price; any other request is anonymous.
  const authorDiscordUserId = await optionalViewer(request, env.DB);
  const id = await insertContribution(env.DB, authorDiscordUserId ? { ...contribution, authorDiscordUserId } : contribution);
  // specs/021 (FR-013): this isolate's cached reads no longer reflect the database.
  clearReadCache();

  return json({ id }, 201);
}
