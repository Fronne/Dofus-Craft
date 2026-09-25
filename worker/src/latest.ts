// specs/016-shared-item-prices: an item's shared HDV price is its latest contribution — no median,
// no age limit (contracts/community-api.md). Only `kind = 'item'` rows count, so a resource row that
// happens to share the identifier never leaks in.

// The one D1 call this needs, typed structurally (like retention.ts) so the module also compiles in
// the app's own test setup, which doesn't load the Workers types.
type LatestDb = {
  prepare(sql: string): { bind(...values: unknown[]): { first<T>(): Promise<T | null> } };
};

export async function readLatestContribution(
  db: LatestDb,
  itemId: string,
  serverId: string,
): Promise<{ amountKamas: number; contributedAt: string } | undefined> {
  const row = await db.prepare(
    `SELECT amount_kamas, created_at FROM community_price_contributions
     WHERE resource_id = ? AND server_id = ? AND kind = 'item'
     ORDER BY created_at DESC LIMIT 1`,
  ).bind(itemId, serverId).first<{ amount_kamas: number; created_at: string }>();
  return row ? { amountKamas: row.amount_kamas, contributedAt: row.created_at } : undefined;
}

// GET /latest-price (contracts/community-api.md), as a status + body pair so index.ts only wraps it
// in a JSON response — and so it can be tested without the Workers runtime types.
export async function latestPriceResponse(db: LatestDb, url: URL): Promise<{ status: number; body: unknown }> {
  const itemId = url.searchParams.get('itemId');
  const serverId = url.searchParams.get('serverId');
  if (!itemId || !serverId) return { status: 400, body: { error: 'itemId and serverId are required' } };
  const latest = await readLatestContribution(db, itemId, serverId);
  if (!latest) return { status: 404, body: null };
  return { status: 200, body: { itemId, serverId, amountKamas: latest.amountKamas, contributedAt: latest.contributedAt } };
}
