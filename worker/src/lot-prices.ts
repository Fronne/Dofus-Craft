import { MAX_BATCH_RESOURCE_IDS } from './contribution';
import { LOT_SIZES, type Ladder, type LotSize } from './unit-price';

// specs/059-prix-par-lot: the last price seen for each HDV lot size of a resource (table
// community_price_lots), written by the friends' tool (sniffer.ts) and read by GET /community-lot-prices.
// The unit price kept for the rest of the site (unit-price.ts) is unaffected.

type Bound<S> = S & { all<T>(): Promise<{ results: T[] }> };
type LotDb<S> = { prepare(sql: string): { bind(...values: unknown[]): Bound<S> } };

// The statements writing one observation's ladder: an upsert per lot on sale, and one delete for the
// lots no longer on sale (their old price would say the lot still exists). `rows` is what they write.
export function lotPriceStatements<S>(
  db: { prepare(sql: string): { bind(...values: unknown[]): S } },
  serverId: string,
  itemId: string,
  ladder: Ladder,
  deviceId: string,
  now: Date,
): { statements: S[]; rows: number } {
  const onSale = LOT_SIZES.filter((size) => (ladder[size] ?? 0) > 0);
  const gone = LOT_SIZES.filter((size) => !onSale.includes(size));
  // One multi-row upsert per observation, not one per lot: a batch of 200 observations stays near 600 statements.
  const statements: S[] = [];
  if (onSale.length > 0) {
    statements.push(db.prepare(
      `INSERT INTO community_price_lots (resource_id, server_id, lot_size, lot_price_kamas, observed_at, device_id)
       VALUES ${onSale.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')}
       ON CONFLICT (resource_id, server_id, lot_size) DO UPDATE SET
         lot_price_kamas = excluded.lot_price_kamas, observed_at = excluded.observed_at, device_id = excluded.device_id`,
    ).bind(...onSale.flatMap((size) => [itemId, serverId, size, ladder[size], now.toISOString(), deviceId])));
  }
  if (gone.length > 0) {
    statements.push(db.prepare(
      `DELETE FROM community_price_lots WHERE resource_id = ? AND server_id = ? AND lot_size IN (${gone.map(() => '?').join(', ')})`,
    ).bind(itemId, serverId, ...gone));
  }
  return { statements, rows: onSale.length };
}

type LotRow = { resource_id: string; lot_size: LotSize; lot_price_kamas: number; observed_at: string };

// GET /community-lot-prices (contracts/community-lot-prices.md). Never returns the sender's key.
export async function lotPricesResponse<S>(db: LotDb<S>, url: URL): Promise<{ status: number; body: unknown }> {
  const serverId = url.searchParams.get('serverId');
  const resourceIds = [...new Set((url.searchParams.get('resourceIds') ?? '').split(',').map((id) => id.trim()).filter(Boolean))];
  if (!serverId || resourceIds.length === 0 || resourceIds.length > MAX_BATCH_RESOURCE_IDS) {
    return { status: 400, body: { error: `serverId and 1 to ${MAX_BATCH_RESOURCE_IDS} resourceIds are required` } };
  }
  const { results } = await db.prepare(
    `SELECT resource_id, lot_size, lot_price_kamas, observed_at FROM community_price_lots
     WHERE server_id = ? AND resource_id IN (${resourceIds.map(() => '?').join(', ')})`,
  ).bind(serverId, ...resourceIds).all<LotRow>();
  const byResource = new Map<string, Record<string, { lotPriceKamas: number; observedAt: string }>>();
  for (const row of results) {
    const lots = byResource.get(row.resource_id) ?? {};
    lots[String(row.lot_size)] = { lotPriceKamas: row.lot_price_kamas, observedAt: row.observed_at };
    byResource.set(row.resource_id, lots);
  }
  return {
    status: 200,
    body: { serverId, prices: resourceIds.filter((id) => byResource.has(id)).map((resourceId) => ({ resourceId, lots: byResource.get(resourceId) })) },
  };
}
