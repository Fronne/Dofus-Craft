import { isRecord, json, noContent, readJson, type FmDb } from './http';

// specs/025-rune-purchase-import (contracts/fm-site-api.md): the logged-in player's own profile.

type MeRow = { discord_user_id: string; display_name: string; avatar_url: string | null; server_id: string | null; is_private: number; first_login_at: string | null; guild_name: string | null };

const MAX_SERVER_ID_LENGTH = 64;

async function readMe(db: FmDb, discordUserId: string) {
  const row = await db.prepare(
    `SELECT discord_user_id, display_name, avatar_url, server_id, is_private, first_login_at,
            (SELECT name FROM fm_guild WHERE id = 'current') AS guild_name
     FROM fm_players WHERE discord_user_id = ?`,
  ).bind(discordUserId).first<MeRow>();
  if (!row) return undefined;
  return {
    discordUserId: row.discord_user_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    serverId: row.server_id,
    isPrivate: row.is_private === 1,
    firstLoginAt: row.first_login_at,
    guildName: row.guild_name,
  };
}

export async function getMe(db: FmDb, discordUserId: string): Promise<Response> {
  const me = await readMe(db, discordUserId);
  return me ? json(me) : json({ error: 'Not found' }, 404);
}

// { serverId?, isPrivate? } — the server the bot's purchases are filed under (FR-005) and the
// visibility (FR-006).
export async function patchMe(request: Request, db: FmDb, discordUserId: string): Promise<Response> {
  const body = await readJson(request);
  if (!isRecord(body)) return json({ error: 'Invalid JSON body' }, 400);
  const { serverId, isPrivate } = body;
  const validServer = serverId === undefined || (typeof serverId === 'string' && serverId.trim() !== '' && serverId.length <= MAX_SERVER_ID_LENGTH);
  const validPrivacy = isPrivate === undefined || typeof isPrivate === 'boolean';
  if (!validServer || !validPrivacy || (serverId === undefined && isPrivate === undefined)) {
    return json({ error: 'serverId (a non-empty string) or isPrivate (a boolean) is required' }, 400);
  }
  if (serverId !== undefined) await db.prepare('UPDATE fm_players SET server_id = ? WHERE discord_user_id = ?').bind(serverId, discordUserId).run();
  if (isPrivate !== undefined) await db.prepare('UPDATE fm_players SET is_private = ? WHERE discord_user_id = ?').bind(isPrivate ? 1 : 0, discordUserId).run();
  return getMe(db, discordUserId);
}

// FR-007: everything about the player, in one transaction. Session totals are computed at read time,
// so they no longer count this player. The price contributions already created stay: they carry no
// player identity and expire after 90 days (research R10).
export async function deleteMe(db: FmDb, discordUserId: string): Promise<Response> {
  await db.batch([
    db.prepare('DELETE FROM fm_auth_sessions WHERE discord_user_id = ?').bind(discordUserId),
    db.prepare('DELETE FROM fm_purchase_lines WHERE capture_id IN (SELECT id FROM fm_captures WHERE discord_user_id = ?)').bind(discordUserId),
    db.prepare('DELETE FROM fm_captures WHERE discord_user_id = ?').bind(discordUserId),
    // specs/027 FR-015: their items in FM go too; the sessions stay, no longer attached.
    db.prepare('UPDATE fm_sessions SET fm_item_id = NULL WHERE fm_item_id IN (SELECT id FROM fm_items WHERE owner_discord_user_id = ?)').bind(discordUserId),
    // specs/028: the sessions they owned stay, with no owner (the reference would block the deletion).
    db.prepare('UPDATE fm_sessions SET owner_discord_user_id = NULL WHERE owner_discord_user_id = ?').bind(discordUserId),
    // specs/029 (research R8): their channels stay, with no owner nor item.
    db.prepare('UPDATE fm_channels SET owner_discord_user_id = NULL, fm_item_id = NULL WHERE owner_discord_user_id = ?').bind(discordUserId),
    db.prepare('DELETE FROM fm_items WHERE owner_discord_user_id = ?').bind(discordUserId),
    db.prepare('DELETE FROM fm_players WHERE discord_user_id = ?').bind(discordUserId),
  ]);
  return noContent();
}
