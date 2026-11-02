import { json, nowIso, type FmDb, type FmStatement } from '../http';
import { MAX_ACTIVE_CHANNELS } from '../channels';
import { placeholders } from '../reads';
import { seanceDetail } from './detail';
import { findSeance } from './list';
import { notFound } from './types';

const cancelPending = (db: FmDb, channelId: string, types: string[], at: string): FmStatement =>
  db.prepare(
    `UPDATE fm_bot_commands SET status = 'cancelled', acknowledged_at = ? WHERE channel_id = ? AND status = 'pending' AND type IN (${placeholders(types.length)})`,
  ).bind(at, channelId, ...types);

// The séance is archived on the site at once (its open session closes); the bot archives the channel.
export async function archiveSeance(db: FmDb, viewerId: string, channelId: string): Promise<Response> {
  const found = await findSeance(db, viewerId, channelId);
  if (!found) return notFound();
  if (found.channel?.status !== 'active') return json({ error: 'not-active' }, 409);
  const at = nowIso();
  await db.batch([
    cancelPending(db, channelId, ['open', 'close', 'reopen-channel'], at),
    db.prepare("UPDATE fm_sessions SET sync_status = 'cancelled' WHERE channel_id = ? AND status = 'open' AND sync_status = 'pending'").bind(channelId),
    db.prepare("UPDATE fm_sessions SET status = 'closed', closed_at = ? WHERE channel_id = ? AND status = 'open'").bind(at, channelId),
    db.prepare("UPDATE fm_channels SET status = 'archived', archived_at = ? WHERE channel_id = ?").bind(at, channelId),
    db.prepare(
      `INSERT INTO fm_bot_commands (id, type, channel_id, status, created_at, requester_discord_user_id) VALUES (?, 'archive-channel', ?, 'pending', ?, ?)`,
    ).bind(crypto.randomUUID(), channelId, at, viewerId),
  ]);
  return json(await seanceDetail(db, viewerId, channelId));
}

// Reopening counts in the limit of active channels, and starts a new session in the channel.
export async function reopenSeance(db: FmDb, viewerId: string, channelId: string): Promise<Response> {
  const found = await findSeance(db, viewerId, channelId);
  if (!found) return notFound();
  if (found.channel?.status !== 'archived') return json({ error: 'not-archived' }, 409);
  const used = await db.prepare(
    `SELECT (SELECT COUNT(*) FROM fm_channels WHERE owner_discord_user_id = ? AND status = 'active')
          + (SELECT COUNT(*) FROM fm_bot_commands WHERE requester_discord_user_id = ? AND type = 'create-channel' AND status = 'pending') AS n`,
  ).bind(viewerId, viewerId).first<{ n: number }>();
  if ((used?.n ?? 0) >= MAX_ACTIVE_CHANNELS) return json({ error: 'channel-limit' }, 409);
  const at = nowIso();
  const sessionId = crypto.randomUUID();
  const command = (type: 'reopen-channel' | 'open', session: string | null) => db.prepare(
    `INSERT INTO fm_bot_commands (id, type, session_id, channel_id, status, created_at, requester_discord_user_id) VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
  ).bind(crypto.randomUUID(), type, session, channelId, at, viewerId);
  await db.batch([
    cancelPending(db, channelId, ['archive-channel'], at),
    db.prepare("UPDATE fm_channels SET status = 'active', archived_at = NULL WHERE channel_id = ?").bind(channelId),
    db.prepare(
      `INSERT INTO fm_sessions (id, channel_id, channel_name, status, opened_at, owner_discord_user_id, origin, sync_status)
       VALUES (?, ?, ?, 'open', ?, ?, 'site', 'pending')`,
    ).bind(sessionId, channelId, found.channel.channel_name, at, viewerId),
    // In this order: the bot reopens the channel, then opens the session in it.
    command('reopen-channel', null),
    command('open', sessionId),
  ]);
  return json(await seanceDetail(db, viewerId, channelId));
}
