// 90 rolling days (specs/004-community-price-sharing FR-013): contributions older than this are
// neither read into the community price nor kept in the database.
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export function retentionCutoff(now: Date = new Date()): string {
  return new Date(now.getTime() - RETENTION_MS).toISOString();
}

// The one D1 call this needs, typed structurally so the module also compiles in the app's own
// test setup, which doesn't load the Workers types (D1Database is assignable to it).
type RetentionDb = {
  prepare(sql: string): { bind(...values: unknown[]): { run(): Promise<{ meta: { changes: number } }> } };
};

// FR-013 (révision 7): run weekly by the Worker's cron trigger (wrangler.toml), so expired
// contributions are actually removed instead of only being filtered out at read time.
// specs/016 (révision de FR-013): an item's shared HDV price is its latest contribution with no age
// limit, so the most recent `kind = 'item'` row of each item and server is spared. Resource rows keep
// the plain 90-day rule — nothing is kept that no workflow needs (constitution, principle V).
export const PURGE_SQL = `DELETE FROM community_price_contributions
  WHERE created_at < ?
  AND NOT (kind = 'item' AND created_at = (
    SELECT MAX(latest.created_at) FROM community_price_contributions latest
    WHERE latest.resource_id = community_price_contributions.resource_id
      AND latest.server_id = community_price_contributions.server_id
      AND latest.kind = 'item'))`;

export async function purgeExpiredContributions(db: RetentionDb, now: Date = new Date()): Promise<number> {
  const result = await db.prepare(PURGE_SQL)
    .bind(retentionCutoff(now))
    .run();
  return result.meta.changes;
}
