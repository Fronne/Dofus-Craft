// specs/016-shared-item-prices: an item's shared HDV price is its latest contribution — no median,
// no age limit (contracts/community-api.md). Only `kind = 'item'` rows count, so a resource row that
// happens to share the identifier never leaks in.

import { HUZOUNET_SOURCE, readExternalPrices } from './external-price';

// The one D1 call this needs, typed structurally (like retention.ts) so the module also compiles in
// the app's own test setup, which doesn't load the Workers types.
type LatestDb = {
  prepare(sql: string): { bind(...values: unknown[]): { first<T>(): Promise<T | null>; all<T>(): Promise<{ results: T[] }> } };
};

type LatestListDb = {
  prepare(sql: string): { bind(...values: unknown[]): { all<T>(): Promise<{ results: T[] }> } };
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
  const group = await readLatestContribution(db, itemId, serverId);
  // specs/045-restore-production-worker: a price read from Huzounet after the group's last one replaces it.
  const external = (await readExternalPrices(db, serverId, [itemId])).get(itemId);
  const latest = external && (!group || external.observedAt > group.contributedAt)
    ? { amountKamas: external.unitPriceKamas, contributedAt: external.observedAt }
    : group;
  if (!latest) return { status: 404, body: null };
  return { status: 200, body: { itemId, serverId, amountKamas: latest.amountKamas, contributedAt: latest.contributedAt } };
}

// specs/019-craft-profit-list (contracts/item-prices-api.md): every item's latest shared HDV price on
// a server, in one query — the same rule as /latest-price, so the Prix page lists exactly the prices
// the item detail would show. Only the amount and its date leave the Worker, never a device id.
const LATEST_ITEM_PRICES_SQL = `SELECT c.resource_id, c.amount_kamas, c.created_at FROM community_price_contributions c
     JOIN (SELECT resource_id, MAX(created_at) AS latest FROM community_price_contributions
           WHERE server_id = ? AND kind = 'item' GROUP BY resource_id) l
       ON c.resource_id = l.resource_id AND c.created_at = l.latest
     WHERE c.server_id = ? AND c.kind = 'item'
     GROUP BY c.resource_id`;

export async function readLatestItemPrices(
  db: LatestListDb,
  serverId: string,
): Promise<{ itemId: string; amountKamas: number; contributedAt: string }[]> {
  const { results } = await db.prepare(LATEST_ITEM_PRICES_SQL).bind(serverId, serverId).all<{ resource_id: string; amount_kamas: number; created_at: string }>();
  const prices = new Map(results.map((row) => [row.resource_id, { itemId: row.resource_id, amountKamas: row.amount_kamas, contributedAt: row.created_at }]));
  // specs/045-restore-production-worker: plus the items Huzounet prices (is_item = 1), the most recent winning.
  const { results: external } = await db.prepare(
    `SELECT resource_id, unit_price_kamas, observed_at FROM external_prices WHERE source = ? AND server_id = ? AND is_item = 1`,
  ).bind(HUZOUNET_SOURCE, serverId).all<{ resource_id: string; unit_price_kamas: number; observed_at: string }>();
  for (const row of external) {
    const group = prices.get(row.resource_id);
    if (!group || row.observed_at > group.contributedAt) {
      prices.set(row.resource_id, { itemId: row.resource_id, amountKamas: row.unit_price_kamas, contributedAt: row.observed_at });
    }
  }
  return [...prices.values()];
}

export async function itemPricesResponse(db: LatestListDb, url: URL): Promise<{ status: number; body: unknown }> {
  const serverId = url.searchParams.get('serverId');
  if (!serverId) return { status: 400, body: { error: 'serverId is required' } };
  return { status: 200, body: { items: await readLatestItemPrices(db, serverId) } };
}
