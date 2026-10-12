import type { FmDb } from './http';
import type { PlayerRow } from './reads';
import { seancesOf } from './seances';

// specs/045-restore-production-worker (contracts/api.md, « Joueurs »): the group's players who spent or
// held a séance de FM, with their séances. A private player is listed for themselves only, and no
// Discord id leaves the Worker: the viewer's own line is marked `isMe`.
export async function listPlayers(db: FmDb, viewerId: string) {
  const { results: players } = await db.prepare(
    'SELECT discord_user_id, display_name, avatar_url, is_private FROM fm_players WHERE is_private = 0 OR discord_user_id = ?',
  ).bind(viewerId).all<PlayerRow>();
  const { results: spendings } = await db.prepare(
    'SELECT discord_user_id AS player, SUM(spent_kamas) AS total_kamas, MAX(created_at) AS last_at FROM fm_captures GROUP BY discord_user_id',
  ).all<{ player: string; total_kamas: number; last_at: string | null }>();
  const { results: seances } = await db.prepare(
    `SELECT player, COUNT(DISTINCT channel_id) AS seance_count, MAX(opened_at) AS last_at FROM (
       SELECT owner_discord_user_id AS player, channel_id, NULL AS opened_at FROM fm_channels WHERE owner_discord_user_id IS NOT NULL
       UNION ALL
       SELECT owner_discord_user_id, channel_id, opened_at FROM fm_sessions WHERE owner_discord_user_id IS NOT NULL
     ) GROUP BY player`,
  ).all<{ player: string; seance_count: number; last_at: string | null }>();
  const spent = new Map(spendings.map((row) => [row.player, row]));
  const made = new Map(seances.map((row) => [row.player, row]));
  const listed = players.filter((player) => spent.has(player.discord_user_id) || made.has(player.discord_user_id));
  const theirs = await seancesOf(db, listed.map((player) => player.discord_user_id));
  const lines = listed.map((player) => {
    const spending = spent.get(player.discord_user_id);
    const seance = made.get(player.discord_user_id);
    const dates = [spending?.last_at, seance?.last_at].filter((date): date is string => typeof date === 'string').sort();
    const own = theirs.get(player.discord_user_id) ?? [];
    return {
      displayName: player.display_name,
      avatarUrl: player.avatar_url,
      isMe: player.discord_user_id === viewerId,
      private: player.is_private === 1,
      totalKamas: spending?.total_kamas ?? 0,
      seanceCount: own.length,
      lastActivityAt: dates.at(-1) ?? null,
      seances: own.map((entry) => ({
        name: entry.name,
        state: entry.state,
        fmItem: entry.fmItem ? { name: entry.fmItem.name, imageUrl: entry.fmItem.imageUrl } : null,
        totalKamas: entry.totalKamas,
        sessionCount: entry.sessionCount,
        lastActivityAt: entry.lastActivityAt,
      })),
    };
  });
  return { players: lines.sort((a, b) => b.totalKamas - a.totalKamas || a.displayName.localeCompare(b.displayName, 'fr')) };
}
