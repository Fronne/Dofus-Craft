import type { FmDb } from './http';

// specs/025-rune-purchase-import (contracts/fm-site-api.md): sessions, players and profiles. Totals are
// computed here from the captures, never stored (data-model.md, "Règles dérivées"), and a private
// player is masked here, in the Worker, for anyone but themselves (FR-014, FR-015, SC-004).

export const SESSIONS_PAGE_SIZE = 20;

type PlayerRow = { discord_user_id: string; display_name: string; avatar_url: string | null; is_private: number };
export type PlayerView = { discordUserId: string | null; displayName: string | null; avatarUrl: string | null; private: boolean };

export function playerView(row: PlayerRow, viewerId: string): PlayerView {
  if (row.is_private === 1 && row.discord_user_id !== viewerId) {
    return { discordUserId: null, displayName: null, avatarUrl: null, private: true };
  }
  return { discordUserId: row.discord_user_id, displayName: row.display_name, avatarUrl: row.avatar_url, private: row.is_private === 1 };
}

type SessionRow = { id: string; channel_name: string; status: 'open' | 'closed'; opened_at: string; closed_at: string | null };
type SpendRow = PlayerRow & { session_id: string; spent_kamas: number };
type ItemRow = { item_name: string; item_id: string | null; quantity: number; total_kamas: number };

const placeholders = (count: number) => Array(count).fill('?').join(', ');

async function withPlayers(db: FmDb, sessions: SessionRow[], viewerId: string) {
  if (sessions.length === 0) return [];
  const { results } = await db.prepare(
    `SELECT c.session_id, p.discord_user_id, p.display_name, p.avatar_url, p.is_private, SUM(c.spent_kamas) AS spent_kamas
     FROM fm_captures c JOIN fm_players p ON p.discord_user_id = c.discord_user_id
     WHERE c.session_id IN (${placeholders(sessions.length)})
     GROUP BY c.session_id, p.discord_user_id
     ORDER BY spent_kamas DESC, p.discord_user_id`,
  ).bind(...sessions.map((session) => session.id)).all<SpendRow>();

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
    };
  });
}

function itemSummaries(rows: ItemRow[]) {
  return rows.map((row) => ({
    itemName: row.item_name,
    itemId: row.item_id,
    quantity: row.quantity,
    totalKamas: row.total_kamas,
    averageUnitKamas: Math.round(row.total_kamas / row.quantity),
  }));
}

const ITEMS_SELECT = `SELECT l.item_name, MAX(l.item_id) AS item_id, SUM(l.quantity) AS quantity, SUM(l.total_kamas) AS total_kamas
  FROM fm_purchase_lines l JOIN fm_captures c ON c.id = l.capture_id`;

export async function sessionsPage(db: FmDb, viewerId: string, before: string | null) {
  const { results } = await db.prepare(
    `SELECT id, channel_name, status, opened_at, closed_at FROM fm_sessions
     WHERE opened_at < ? ORDER BY opened_at DESC, id DESC LIMIT ?`,
  ).bind(before ?? '9999', SESSIONS_PAGE_SIZE + 1).all<SessionRow>();
  const page = results.slice(0, SESSIONS_PAGE_SIZE);
  return {
    sessions: await withPlayers(db, page, viewerId),
    nextBefore: results.length > SESSIONS_PAGE_SIZE ? page[page.length - 1].opened_at : null,
  };
}

export async function sessionDetail(db: FmDb, viewerId: string, sessionId: string) {
  const session = await db.prepare('SELECT id, channel_name, status, opened_at, closed_at FROM fm_sessions WHERE id = ?')
    .bind(sessionId).first<SessionRow>();
  if (!session) return undefined;
  const [summary] = await withPlayers(db, [session], viewerId);
  const { results } = await db.prepare(`${ITEMS_SELECT} WHERE c.session_id = ? GROUP BY l.item_name ORDER BY total_kamas DESC, l.item_name`)
    .bind(sessionId).all<ItemRow>();
  return { ...summary, items: itemSummaries(results) };
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
  };
}
