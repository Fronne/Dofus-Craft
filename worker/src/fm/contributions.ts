import { retentionCutoff } from '../retention';
import { json, type FmDb } from './http';

// specs/082-auteur-prix-communautaires (contracts/price-author-api.md): « Mes contributions » — the prices the
// logged-in player entered and that are still kept (prices are purged after 90 days), the 20 latest first. The
// player always sees all of them, whatever their privacy setting.
const RECENT_LIMIT = 20;

type ContributionRow = { resource_id: string; kind: 'resource' | 'item'; server_id: string; amount_kamas: number; created_at: string };

export async function getMyContributions(db: FmDb, discordUserId: string): Promise<Response> {
  const cutoff = retentionCutoff();
  const count = await db.prepare(
    'SELECT COUNT(*) AS total FROM community_price_contributions WHERE author_discord_user_id = ? AND created_at >= ?',
  ).bind(discordUserId, cutoff).first<{ total: number }>();
  const { results } = await db.prepare(
    `SELECT resource_id, kind, server_id, amount_kamas, created_at FROM community_price_contributions
     WHERE author_discord_user_id = ? AND created_at >= ?
     ORDER BY created_at DESC, rowid DESC LIMIT ?`,
  ).bind(discordUserId, cutoff, RECENT_LIMIT).all<ContributionRow>();
  return json({
    total: count?.total ?? 0,
    recent: results.map((row) => ({
      resourceId: row.resource_id,
      kind: row.kind,
      serverId: row.server_id,
      amountKamas: row.amount_kamas,
      createdAt: row.created_at,
    })),
  });
}
