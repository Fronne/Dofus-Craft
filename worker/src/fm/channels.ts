import { isRecord, json, nowIso, readJson, type FmDb } from './http';

// specs/029-channel-ownership (contracts/fm-channels-api.md): a player's personal FM channels, created by the
// Discord bot (bot-events.ts), asking the bot to create one from the site, and attaching a whole channel
// to an item in FM (FR-011).

export const MAX_ACTIVE_CHANNELS = 5;
const MAX_NAME_LENGTH = 30;

const notFound = () => json({ error: 'Not found' }, 404);

// FR-009, FR-010: only the player's own active channels are ever offered.
export async function listMyChannels(db: FmDb, viewerId: string): Promise<Response> {
  const { results } = await db.prepare(
    `SELECT ch.channel_id, ch.channel_name, ch.status, ch.fm_item_id, i.label, i.item_name,
            EXISTS (SELECT 1 FROM fm_sessions s WHERE s.channel_id = ch.channel_id AND s.status = 'open') AS busy
     FROM fm_channels ch LEFT JOIN fm_items i ON i.id = ch.fm_item_id
     WHERE ch.owner_discord_user_id = ? AND ch.status = 'active'
     ORDER BY ch.channel_name`,
  ).bind(viewerId).all<ChannelRow & { busy: number }>();
  return json({ channels: results.map((row) => ({ ...channelView(row), busy: row.busy === 1 })) });
}

export type ChannelRow = {
  channel_id: string; channel_name: string; status: 'active' | 'archived' | 'deleted';
  fm_item_id: string | null; label: string | null; item_name: string | null;
};

export function channelView(row: ChannelRow) {
  return {
    channelId: row.channel_id,
    channelName: row.channel_name,
    status: row.status,
    fmItem: row.fm_item_id && row.item_name ? { id: row.fm_item_id, name: row.label ?? row.item_name } : null,
  };
}

// A player's channels (active and archived) for their profile (FR-013).
export async function playerChannels(db: FmDb, discordUserId: string) {
  const { results } = await db.prepare(
    `SELECT ch.channel_id, ch.channel_name, ch.status, ch.fm_item_id, i.label, i.item_name
     FROM fm_channels ch LEFT JOIN fm_items i ON i.id = ch.fm_item_id
     WHERE ch.owner_discord_user_id = ? AND ch.status IN ('active', 'archived')
     ORDER BY ch.status, ch.channel_name`,
  ).bind(discordUserId).all<ChannelRow>();
  return results.map(channelView);
}

async function ownItem(db: FmDb, viewerId: string, fmItemId: string) {
  return (await db.prepare('SELECT 1 AS mine FROM fm_items WHERE id = ? AND owner_discord_user_id = ?').bind(fmItemId, viewerId).first()) !== null;
}

// FR-009: ask the bot to create a channel; the limit counts active channels and requests still waiting (FR-003).
export async function requestChannel(request: Request, db: FmDb, viewerId: string): Promise<Response> {
  const body = await readJson(request);
  const name = isRecord(body) && typeof body.name === 'string' ? body.name.trim() : '';
  const fmItemId = isRecord(body) && typeof body.fmItemId === 'string' && body.fmItemId ? body.fmItemId : null;
  if (!name || name.length > MAX_NAME_LENGTH) return json({ error: `name must be 1 to ${MAX_NAME_LENGTH} characters` }, 400);
  if (fmItemId && !(await ownItem(db, viewerId, fmItemId))) return notFound();

  const used = await db.prepare(
    `SELECT (SELECT COUNT(*) FROM fm_channels WHERE owner_discord_user_id = ? AND status = 'active')
          + (SELECT COUNT(*) FROM fm_bot_commands WHERE requester_discord_user_id = ? AND type = 'create-channel' AND status = 'pending') AS n`,
  ).bind(viewerId, viewerId).first<{ n: number }>();
  if ((used?.n ?? 0) >= MAX_ACTIVE_CHANNELS) return json({ error: 'channel-limit' }, 409);

  const requestId = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO fm_bot_commands (id, type, status, created_at, requested_name, requester_discord_user_id, fm_item_id)
     VALUES (?, 'create-channel', 'pending', ?, ?, ?, ?)`,
  ).bind(requestId, nowIso(), name, viewerId, fmItemId).run();
  return json({ requestId }, 202);
}

export async function readChannelRequest(db: FmDb, viewerId: string, requestId: string): Promise<Response> {
  const row = await db.prepare(
    `SELECT id, status, error, result_channel_id FROM fm_bot_commands
     WHERE id = ? AND type = 'create-channel' AND requester_discord_user_id = ?`,
  ).bind(requestId, viewerId).first<{ id: string; status: 'pending' | 'done' | 'failed' | 'cancelled'; error: string | null; result_channel_id: string | null }>();
  if (!row) return notFound();
  const session = row.result_channel_id
    ? await db.prepare("SELECT id FROM fm_sessions WHERE channel_id = ? AND status = 'open'").bind(row.result_channel_id).first<{ id: string }>()
    : null;
  return json({
    id: row.id,
    status: row.status === 'cancelled' ? 'failed' : row.status,
    error: row.error,
    channelId: row.result_channel_id,
    sessionId: session?.id ?? null,
  });
}

// FR-011: attach a whole channel to one of the owner's items (or detach it with null).
export async function attachChannelItem(request: Request, db: FmDb, viewerId: string, channelId: string): Promise<Response> {
  const body = await readJson(request);
  if (!isRecord(body) || !('fmItemId' in body) || (body.fmItemId !== null && typeof body.fmItemId !== 'string')) {
    return json({ error: 'fmItemId (or null) is required' }, 400);
  }
  const channel = await db.prepare('SELECT owner_discord_user_id FROM fm_channels WHERE channel_id = ?').bind(channelId).first<{ owner_discord_user_id: string | null }>();
  // specs/030-private-fm-sessions (FR-008): another player's channel is not found.
  if (!channel || channel.owner_discord_user_id !== viewerId) return notFound();
  const fmItemId = body.fmItemId as string | null;
  if (fmItemId && !(await ownItem(db, viewerId, fmItemId))) return notFound();
  await db.prepare('UPDATE fm_channels SET fm_item_id = ? WHERE channel_id = ?').bind(fmItemId, channelId).run();
  const row = await db.prepare(
    `SELECT ch.channel_id, ch.channel_name, ch.status, ch.fm_item_id, i.label, i.item_name
     FROM fm_channels ch LEFT JOIN fm_items i ON i.id = ch.fm_item_id WHERE ch.channel_id = ?`,
  ).bind(channelId).first<ChannelRow>();
  return json(channelView(row!));
}
