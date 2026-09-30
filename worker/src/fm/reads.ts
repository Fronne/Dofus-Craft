import type { FmDb } from './http';

// specs/025-rune-purchase-import (contracts/fm-site-api.md): sessions, players and profiles. Totals are
// computed here from the captures, never stored (data-model.md, "Règles dérivées"), and a private
// player is masked here, in the Worker, for anyone but themselves (FR-014, FR-015, SC-004).

export const SESSIONS_PAGE_SIZE = 20;

export type PlayerRow = { discord_user_id: string; display_name: string; avatar_url: string | null; is_private: number };
export type PlayerView = { discordUserId: string | null; displayName: string | null; avatarUrl: string | null; private: boolean };

export function playerView(row: PlayerRow, viewerId: string): PlayerView {
  if (row.is_private === 1 && row.discord_user_id !== viewerId) {
    return { discordUserId: null, displayName: null, avatarUrl: null, private: true };
  }
  return { discordUserId: row.discord_user_id, displayName: row.display_name, avatarUrl: row.avatar_url, private: row.is_private === 1 };
}

export type SessionRow = {
  id: string; channel_name: string; status: 'open' | 'closed'; opened_at: string; closed_at: string | null; fm_item_id: string | null;
  // specs/028-site-started-sessions.
  owner_discord_user_id: string | null; origin: 'discord' | 'site'; sync_status: 'pending' | 'opened' | 'failed' | 'cancelled' | null; sync_error: string | null;
};

export const SESSION_COLUMNS = 'id, channel_name, status, opened_at, closed_at, fm_item_id, owner_discord_user_id, origin, sync_status, sync_error';

// specs/028 FR-011: a request the bot hasn't acknowledged after 10 minutes reads as « not transmitted ».
export const STALE_AFTER_MS = 10 * 60 * 1000;
type SpendRow = PlayerRow & { session_id: string; spent_kamas: number };
export type ItemRow = { item_name: string; item_id: string | null; quantity: number; total_kamas: number };

// specs/027-fm-item-recap (FR-008): the item a session is attached to, as the viewer may see it.
export type SessionItemView = { id: string; name: string; owner: PlayerView } | { private: true };
type OwnedItemRow = PlayerRow & { id: string; label: string | null; item_name: string };

async function sessionItems(db: FmDb, itemIds: string[], viewerId: string): Promise<Map<string, SessionItemView>> {
  const views = new Map<string, SessionItemView>();
  if (itemIds.length === 0) return views;
  const { results } = await db.prepare(
    `SELECT i.id, i.label, i.item_name, p.discord_user_id, p.display_name, p.avatar_url, p.is_private
     FROM fm_items i JOIN fm_players p ON p.discord_user_id = i.owner_discord_user_id
     WHERE i.id IN (${placeholders(itemIds.length)})`,
  ).bind(...itemIds).all<OwnedItemRow>();
  for (const row of results) {
    const owner = playerView(row, viewerId);
    views.set(row.id, owner.private && owner.displayName === null ? { private: true } : { id: row.id, name: row.label ?? row.item_name, owner });
  }
  return views;
}

export const placeholders = (count: number) => Array(count).fill('?').join(', ');

export async function withPlayers(db: FmDb, sessions: SessionRow[], viewerId: string) {
  if (sessions.length === 0) return [];
  const { results } = await db.prepare(
    `SELECT c.session_id, p.discord_user_id, p.display_name, p.avatar_url, p.is_private, SUM(c.spent_kamas) AS spent_kamas
     FROM fm_captures c JOIN fm_players p ON p.discord_user_id = c.discord_user_id
     WHERE c.session_id IN (${placeholders(sessions.length)})
     GROUP BY c.session_id, p.discord_user_id
     ORDER BY spent_kamas DESC, p.discord_user_id`,
  ).bind(...sessions.map((session) => session.id)).all<SpendRow>();
  const items = await sessionItems(db, [...new Set(sessions.flatMap((session) => (session.fm_item_id ? [session.fm_item_id] : [])))], viewerId);
  const ownerIds = [...new Set(sessions.flatMap((session) => (session.owner_discord_user_id ? [session.owner_discord_user_id] : [])))];
  const { results: ownerRows } = ownerIds.length === 0 ? { results: [] as PlayerRow[] } : await db.prepare(
    `SELECT discord_user_id, display_name, avatar_url, is_private FROM fm_players WHERE discord_user_id IN (${placeholders(ownerIds.length)})`,
  ).bind(...ownerIds).all<PlayerRow>();
  const owners = new Map(ownerRows.map((row) => [row.discord_user_id, playerView(row, viewerId)]));
  const pendingIds = sessions.filter((session) => session.sync_status === 'pending').map((session) => session.id);
  const { results: pendingRows } = pendingIds.length === 0 ? { results: [] as { session_id: string; created_at: string }[] } : await db.prepare(
    `SELECT session_id, MIN(created_at) AS created_at FROM fm_bot_commands
     WHERE type = 'open' AND status = 'pending' AND session_id IN (${placeholders(pendingIds.length)}) GROUP BY session_id`,
  ).bind(...pendingIds).all<{ session_id: string; created_at: string }>();
  const staleBefore = new Date(Date.now() - STALE_AFTER_MS).toISOString();
  const stale = new Set(pendingRows.filter((row) => row.created_at < staleBefore).map((row) => row.session_id));

  return sessions.map((session) => {
    const spends = results.filter((row) => row.session_id === session.id);
    return {
      id: session.id,
      channelName: session.channel_name,
      status: session.status,
      openedAt: session.opened_at,
      closedAt: session.closed_at,
      totalKamas: spends.reduce((total, row) => total + row.spent_kamas, 0),
      players: spends.map((row) => ({ player: playerView(row, viewerId), spentKamas: row.spent_kamas })),
      fmItem: session.fm_item_id ? items.get(session.fm_item_id) ?? null : null,
      owner: session.owner_discord_user_id ? owners.get(session.owner_discord_user_id) ?? null : null,
      origin: session.origin,
      sync: session.origin === 'site' && session.sync_status
        ? { status: stale.has(session.id) ? 'stale' as const : session.sync_status, error: session.sync_error }
        : null,
      canStop: session.status === 'open' && session.owner_discord_user_id === viewerId,
    };
  });
}

export function itemSummaries(rows: ItemRow[]) {
  return rows.map((row) => ({
    itemName: row.item_name,
    itemId: row.item_id,
    quantity: row.quantity,
    totalKamas: row.total_kamas,
    averageUnitKamas: Math.round(row.total_kamas / row.quantity),
  }));
}

export const ITEMS_SELECT = `SELECT l.item_name, MAX(l.item_id) AS item_id, SUM(l.quantity) AS quantity, SUM(l.total_kamas) AS total_kamas
  FROM fm_purchase_lines l JOIN fm_captures c ON c.id = l.capture_id`;

export async function sessionsPage(db: FmDb, viewerId: string, before: string | null, mine: string | null = null) {
  // specs/028 (research R7): the viewer's open sessions, for the capture import.
  if (mine === 'open') {
    const { results } = await db.prepare(
      `SELECT ${SESSION_COLUMNS} FROM fm_sessions WHERE status = 'open' AND owner_discord_user_id = ? ORDER BY opened_at DESC, id DESC`,
    ).bind(viewerId).all<SessionRow>();
    return { sessions: await withPlayers(db, results, viewerId), nextBefore: null };
  }
  const { results } = await db.prepare(
    `SELECT ${SESSION_COLUMNS} FROM fm_sessions
     WHERE opened_at < ? ORDER BY opened_at DESC, id DESC LIMIT ?`,
  ).bind(before ?? '9999', SESSIONS_PAGE_SIZE + 1).all<SessionRow>();
  const page = results.slice(0, SESSIONS_PAGE_SIZE);
  return {
    sessions: await withPlayers(db, page, viewerId),
    nextBefore: results.length > SESSIONS_PAGE_SIZE ? page[page.length - 1].opened_at : null,
  };
}

export async function sessionDetail(db: FmDb, viewerId: string, sessionId: string) {
  const session = await db.prepare(`SELECT ${SESSION_COLUMNS} FROM fm_sessions WHERE id = ?`)
    .bind(sessionId).first<SessionRow>();
  if (!session) return undefined;
  const [summary] = await withPlayers(db, [session], viewerId);
  const { results } = await db.prepare(`${ITEMS_SELECT} WHERE c.session_id = ? GROUP BY l.item_name ORDER BY total_kamas DESC, l.item_name`)
    .bind(sessionId).all<ItemRow>();
  // specs/027 FR-005 / FR-007: what the viewer may do with the session's item.
  const spent = await db.prepare('SELECT 1 AS spent FROM fm_captures WHERE session_id = ? AND discord_user_id = ? LIMIT 1')
    .bind(sessionId, viewerId).first<{ spent: number }>();
  const owner = session.fm_item_id
    ? await db.prepare('SELECT owner_discord_user_id FROM fm_items WHERE id = ?').bind(session.fm_item_id).first<{ owner_discord_user_id: string }>()
    : null;
  return {
    ...summary,
    items: itemSummaries(results),
    canAttach: session.fm_item_id === null && spent !== null,
    canDetach: owner?.owner_discord_user_id === viewerId,
  };
}

// specs/027-fm-item-recap: items in FM with the total of their attached sessions (same total as a
// session: the captures' spending), newest first. `where` filters on `i` (fm_items) and `p` (owner).
type OwnedItemTotalsRow = PlayerRow & {
  id: string; item_id: string; item_name: string; item_image_url: string | null; label: string | null;
  total_kamas: number; session_count: number;
};

export async function ownedItems(db: FmDb, viewerId: string, where: string, ...params: unknown[]) {
  const { results } = await db.prepare(
    `SELECT i.id, i.item_id, i.item_name, i.item_image_url, i.label,
            p.discord_user_id, p.display_name, p.avatar_url, p.is_private,
            (SELECT COALESCE(SUM(c.spent_kamas), 0) FROM fm_captures c JOIN fm_sessions s ON s.id = c.session_id WHERE s.fm_item_id = i.id) AS total_kamas,
            (SELECT COUNT(*) FROM fm_sessions s WHERE s.fm_item_id = i.id) AS session_count
     FROM fm_items i JOIN fm_players p ON p.discord_user_id = i.owner_discord_user_id
     WHERE ${where}
     ORDER BY i.created_at DESC, i.id`,
  ).bind(...params).all<OwnedItemTotalsRow>();
  return results.map((row) => ({
    id: row.id,
    itemId: row.item_id,
    itemName: row.item_name,
    imageUrl: row.item_image_url,
    label: row.label,
    owner: playerView(row, viewerId),
    totalKamas: row.total_kamas,
    sessionCount: row.session_count,
  }));
}

// Public players, plus the viewer even when private, with what each spent in all.
export async function listPlayers(db: FmDb, viewerId: string) {
  const { results } = await db.prepare(
    `SELECT p.discord_user_id, p.display_name, p.avatar_url, p.is_private, COALESCE(SUM(c.spent_kamas), 0) AS total_kamas
     FROM fm_players p LEFT JOIN fm_captures c ON c.discord_user_id = p.discord_user_id
     WHERE p.is_private = 0 OR p.discord_user_id = ?
     GROUP BY p.discord_user_id
     ORDER BY total_kamas DESC, p.display_name`,
  ).bind(viewerId).all<PlayerRow & { total_kamas: number }>();
  return { players: results.map((row) => ({ ...playerView(row, viewerId), totalKamas: row.total_kamas })) };
}

// A player's spending (FR-016). Undefined when unknown, or private and not the viewer (FR-014).
export async function playerProfile(db: FmDb, viewerId: string, discordUserId: string) {
  const row = await db.prepare('SELECT discord_user_id, display_name, avatar_url, is_private FROM fm_players WHERE discord_user_id = ?')
    .bind(discordUserId).first<PlayerRow>();
  if (!row || (row.is_private === 1 && discordUserId !== viewerId)) return undefined;

  const { results: sessions } = await db.prepare(
    `SELECT s.id AS session_id, s.channel_name, s.opened_at, SUM(c.spent_kamas) AS spent_kamas
     FROM fm_captures c JOIN fm_sessions s ON s.id = c.session_id
     WHERE c.discord_user_id = ?
     GROUP BY s.id ORDER BY s.opened_at DESC`,
  ).bind(discordUserId).all<{ session_id: string; channel_name: string; opened_at: string; spent_kamas: number }>();
  const imported = await db.prepare(
    'SELECT COALESCE(SUM(spent_kamas), 0) AS total FROM fm_captures WHERE discord_user_id = ? AND session_id IS NULL',
  ).bind(discordUserId).first<{ total: number }>();
  const { results: items } = await db.prepare(`${ITEMS_SELECT} WHERE c.discord_user_id = ? GROUP BY l.item_name ORDER BY total_kamas DESC, l.item_name`)
    .bind(discordUserId).all<ItemRow>();

  const importedKamas = imported?.total ?? 0;
  return {
    player: playerView(row, viewerId),
    totalKamas: sessions.reduce((total, session) => total + session.spent_kamas, importedKamas),
    sessions: sessions.map((session) => ({
      sessionId: session.session_id,
      channelName: session.channel_name,
      openedAt: session.opened_at,
      spentKamas: session.spent_kamas,
    })),
    importedKamas,
    items: itemSummaries(items),
    // specs/027 FR-014: the profile's visibility already let the viewer this far.
    fmItems: await ownedItems(db, viewerId, 'i.owner_discord_user_id = ?', discordUserId),
  };
}
