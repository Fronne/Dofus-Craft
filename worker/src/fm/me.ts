import { clearReadCache } from '../read-cache';
import { isRecord, json, noContent, readJson, type FmDb } from './http';

// specs/025-rune-purchase-import (contracts/fm-site-api.md): the logged-in player's own profile.
// specs/075-connexion-discord-site: shared by the whole site — it also says whether
// the session's player is a member of the group's Discord server.

type MeRow = { discord_user_id: string; display_name: string; avatar_url: string | null; server_id: string | null; is_private: number; first_login_at: string | null; guild_name: string | null };

const MAX_SERVER_ID_LENGTH = 64;

async function readMe(db: FmDb, discordUserId: string, isMember: boolean) {
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
    isMember,
  };
}

export async function getMe(db: FmDb, discordUserId: string, isMember: boolean): Promise<Response> {
  const me = await readMe(db, discordUserId, isMember);
  return me ? json(me) : json({ error: 'Not found' }, 404);
}

// { serverId?, isPrivate? } — the server the bot's purchases are filed under (FR-005) and the visibility (FR-006).
export async function patchMe(request: Request, db: FmDb, discordUserId: string, isMember: boolean): Promise<Response> {
  const body = await readJson(request);
  if (!isRecord(body)) return json({ error: 'Invalid JSON body' }, 400);
  const { serverId, isPrivate } = body;
  const validServer = serverId === undefined || (typeof serverId === 'string' && serverId.trim() !== '' && serverId.length <= MAX_SERVER_ID_LENGTH);
  const validPrivacy = isPrivate === undefined || typeof isPrivate === 'boolean';
  if (!validServer || !validPrivacy || (serverId === undefined && isPrivate === undefined)) {
    return json({ error: 'serverId (a non-empty string) or isPrivate (a boolean) is required' }, 400);
  }
  if (serverId !== undefined) await db.prepare('UPDATE fm_players SET server_id = ? WHERE discord_user_id = ?').bind(serverId, discordUserId).run();
  if (isPrivate !== undefined) {
    await db.prepare('UPDATE fm_players SET is_private = ? WHERE discord_user_id = ?').bind(isPrivate ? 1 : 0, discordUserId).run();
    // specs/082-auteur-prix-communautaires: the name shown on this player's prices follows the setting at once.
    clearReadCache();
  }
  return getMe(db, discordUserId, isMember);
}

// FR-007: everything about the player, in one transaction. Session totals are computed at read time,
// so they no longer count this player. The price contributions already created stay: specs/082 cuts their link
// to the player (author = NULL), so they carry no player identity and expire after 90 days (research R10).
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
    // specs/082-auteur-prix-communautaires: their prices stay in the group's data, anonymous.
    db.prepare('UPDATE community_price_contributions SET author_discord_user_id = NULL WHERE author_discord_user_id = ?').bind(discordUserId),
    db.prepare('UPDATE app_visits SET discord_user_id = NULL WHERE discord_user_id = ?').bind(discordUserId),
    db.prepare('DELETE FROM fm_players WHERE discord_user_id = ?').bind(discordUserId),
  ]);
  clearReadCache();
  return noContent();
}
