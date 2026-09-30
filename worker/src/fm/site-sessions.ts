import { isRecord, json, nowIso, readJson, type FmDb, type FmStatement } from './http';
import { sessionDetail } from './reads';

// specs/028-site-started-sessions (contracts/fm-site-sessions-api.md): starting, stopping and resending
// an FM session from the site. The session exists on the site at once; a request is queued for the
// Discord bot, which fetches it (bot-commands.ts). The channel links both sides, as for /fmstart.

const notFound = () => json({ error: 'Not found' }, 404);

const openCommand = (db: FmDb, sessionId: string, channelId: string, at: string): FmStatement =>
  db.prepare(`INSERT INTO fm_bot_commands (id, type, session_id, channel_id, status, created_at) VALUES (?, 'open', ?, ?, 'pending', ?)`)
    .bind(crypto.randomUUID(), sessionId, channelId, at);

// specs/029 (FR-010): a session starts from the site only in one of the player's own active channels.
async function myActiveChannelName(db: FmDb, viewerId: string, channelId: string): Promise<string | undefined> {
  const row = await db.prepare("SELECT channel_name FROM fm_channels WHERE channel_id = ? AND owner_discord_user_id = ? AND status = 'active'")
    .bind(channelId, viewerId).first<{ channel_name: string }>();
  return row?.channel_name;
}

const channelBusy = async (db: FmDb, channelId: string) =>
  (await db.prepare("SELECT 1 AS busy FROM fm_sessions WHERE channel_id = ? AND status = 'open' LIMIT 1").bind(channelId).first()) !== null;

export async function startSession(request: Request, db: FmDb, viewerId: string): Promise<Response> {
  const body = await readJson(request);
  if (!isRecord(body) || typeof body.channelId !== 'string' || (body.fmItemId !== undefined && body.fmItemId !== null && typeof body.fmItemId !== 'string')) {
    return json({ error: 'channelId and an optional fmItemId are required' }, 400);
  }
  const channelId = body.channelId;
  const fmItemId = (body.fmItemId as string | null | undefined) ?? null;
  const name = await myActiveChannelName(db, viewerId, channelId);
  if (!name) return json({ error: 'not-your-channel' }, 403);
  if (fmItemId) {
    const item = await db.prepare('SELECT 1 AS mine FROM fm_items WHERE id = ? AND owner_discord_user_id = ?').bind(fmItemId, viewerId).first();
    if (!item) return notFound();
  }
  // FR-002: one open session per channel, as in the bot.
  if (await channelBusy(db, channelId)) return json({ error: 'channel-busy' }, 409);

  const sessionId = crypto.randomUUID();
  const at = nowIso();
  try {
    await db.batch([
      db.prepare(
        `INSERT INTO fm_sessions (id, channel_id, channel_name, status, opened_at, fm_item_id, owner_discord_user_id, origin, sync_status)
         VALUES (?, ?, ?, 'open', ?, ?, ?, 'site', 'pending')`,
      ).bind(sessionId, channelId, name, at, fmItemId, viewerId),
      openCommand(db, sessionId, channelId, at),
    ]);
  } catch {
    // The unique « one open session per channel » index: someone opened one in between.
    if (await channelBusy(db, channelId)) return json({ error: 'channel-busy' }, 409);
    throw new Error('Could not start the session');
  }
  return json(await sessionDetail(db, viewerId, sessionId), 201);
}

type OwnedSession = { id: string; channel_id: string; status: 'open' | 'closed'; owner_discord_user_id: string | null; origin: 'discord' | 'site'; sync_status: string | null };

async function ownedSession(db: FmDb, viewerId: string, sessionId: string): Promise<OwnedSession | Response> {
  const session = await db.prepare('SELECT id, channel_id, status, owner_discord_user_id, origin, sync_status FROM fm_sessions WHERE id = ?')
    .bind(sessionId).first<OwnedSession>();
  if (!session) return notFound();
  if (session.owner_discord_user_id !== viewerId) return json({ error: 'Forbidden' }, 403);
  if (session.status !== 'open') return json({ error: 'not-open' }, 409);
  return session;
}

// FR-004, FR-009, FR-010 (data-model « Transitions »).
export async function stopSession(db: FmDb, viewerId: string, sessionId: string): Promise<Response> {
  const session = await ownedSession(db, viewerId, sessionId);
  if (session instanceof Response) return session;
  const at = nowIso();
  const pendingOpen = await db.prepare("SELECT id FROM fm_bot_commands WHERE session_id = ? AND type = 'open' AND status = 'pending' LIMIT 1")
    .bind(sessionId).first<{ id: string }>();
  const statements: FmStatement[] = [
    db.prepare("UPDATE fm_sessions SET status = 'closed', closed_at = ? WHERE id = ?").bind(at, sessionId),
  ];
  if (pendingOpen) {
    // The bot never opened it: both requests cancel out, nothing to close in Discord.
    statements.push(
      db.prepare("UPDATE fm_bot_commands SET status = 'cancelled', acknowledged_at = ? WHERE session_id = ? AND type = 'open' AND status = 'pending'").bind(at, sessionId),
      db.prepare("UPDATE fm_sessions SET sync_status = 'cancelled' WHERE id = ?").bind(sessionId),
    );
  } else {
    statements.push(db.prepare(
      `INSERT INTO fm_bot_commands (id, type, session_id, channel_id, status, created_at) VALUES (?, 'close', ?, ?, 'pending', ?)`,
    ).bind(crypto.randomUUID(), sessionId, session.channel_id, at));
  }
  await db.batch(statements);
  return json(await sessionDetail(db, viewerId, sessionId));
}

// FR-011: « Relancer » a request the bot didn't pick up, or that failed.
export async function resendSession(db: FmDb, viewerId: string, sessionId: string): Promise<Response> {
  const session = await ownedSession(db, viewerId, sessionId);
  if (session instanceof Response) return session;
  if (session.origin !== 'site' || (session.sync_status !== 'pending' && session.sync_status !== 'failed')) {
    return json({ error: 'nothing-to-resend' }, 409);
  }
  const at = nowIso();
  await db.batch([
    db.prepare("UPDATE fm_bot_commands SET status = 'cancelled', acknowledged_at = ? WHERE session_id = ? AND type = 'open' AND status = 'pending'").bind(at, sessionId),
    db.prepare("UPDATE fm_sessions SET sync_status = 'pending', sync_error = NULL WHERE id = ?").bind(sessionId),
    openCommand(db, sessionId, session.channel_id, at),
  ]);
  return json(await sessionDetail(db, viewerId, sessionId));
}
