import { summarizeContributions, type ContributionRow, type ContributionsSummary, type PriceOrigin } from './median';
import { retentionCutoff } from './retention';
import { resolveOutlierFields } from './outlier';
import { readLatestContribution } from './latest';
import { readExternalPrices, withExternalPrice } from './external-price';
import type { ItemType } from './item-types';

// Upper bound for a single contribution: the in-game kamas cap. Anything above can only be a typo
// or an abusive request, and would never be a real price.
export const MAX_AMOUNT_KAMAS = 2_000_000_000;

// specs/016: 'item' for an item's shared HDV price, 'resource' (the default, and every row before
// this feature) for a resource price.
export type ContributionKind = 'resource' | 'item';
// specs/025-rune-purchase-import: `origin` is 'manual' for everything posted by the site's public route
// (the client can't claim another one); only the Forgemagie routes record 'capture' or 'bot'.
// specs/071-sniffer-tous-hdv: `itemType`, the nature the friends' tool 0.4.0+ gives a price; absent (NULL)
// everywhere else.
export type Contribution = { resourceId: string; serverId: string; amountKamas: number; deviceId: string; kind: ContributionKind; origin: PriceOrigin; itemType?: ItemType };

// The D1 calls these need, typed structurally (like retention.ts) so the module also compiles in
// the app's test setup, which doesn't load the Workers types. D1Database is assignable to it.
type ContributionDb = {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      all<T>(): Promise<{ results: T[] }>;
      first<T>(): Promise<T | null>;
      run(): Promise<unknown>;
    };
  };
};

// Validates a POST /community-price body; `kind` is optional ('item', or absent for a resource) and
// any other value is refused (contracts/community-api.md).
export function parseContributionPayload(value: unknown): Contribution | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const record = value as Record<string, unknown>;
  const valid = typeof record.resourceId === 'string' &&
    typeof record.serverId === 'string' &&
    typeof record.amountKamas === 'number' &&
    record.amountKamas >= 0 &&
    record.amountKamas <= MAX_AMOUNT_KAMAS &&
    typeof record.deviceId === 'string' &&
    record.deviceId.length > 0 &&
    (record.kind === undefined || record.kind === 'item');
  if (!valid) return undefined;
  return {
    resourceId: record.resourceId as string,
    serverId: record.serverId as string,
    amountKamas: record.amountKamas as number,
    deviceId: record.deviceId as string,
    kind: record.kind === 'item' ? 'item' : 'resource',
    origin: 'manual',
  };
}

// specs/007-outlier-confirmation: the median a resource contribution is compared against, from the
// exact same query and aggregation as a plain read — never a separately-maintained calculation.
export async function fetchCurrentMedian(
  db: ContributionDb,
  resourceId: string,
  serverId: string,
): Promise<ContributionsSummary | undefined> {
  const { results } = await db.prepare(
    `SELECT amount_kamas, created_at, device_id, origin FROM community_price_contributions
     WHERE resource_id = ? AND server_id = ? AND created_at >= ? AND kind = 'resource'
     ORDER BY created_at, rowid`,
  ).bind(resourceId, serverId, retentionCutoff()).all<{ amount_kamas: number; created_at: string; device_id: string; origin: PriceOrigin }>();

  return summarizeContributions(results.map((row) => ({
    amountKamas: row.amount_kamas,
    createdAt: row.created_at,
    deviceId: row.device_id,
    origin: row.origin,
  })));
}

// specs/021-background-data-loading (FR-010): the same medians as `fetchCurrentMedian`, for several
// resources of one server in a single query. Resources with no median are left out.
// D1 binds at most 100 parameters per query: the ids plus `serverId` and the retention cutoff.
export const MAX_BATCH_RESOURCE_IDS = 98;

export async function fetchCurrentMedians(
  db: ContributionDb,
  resourceIds: string[],
  serverId: string,
): Promise<Map<string, ContributionsSummary>> {
  const medians = new Map<string, ContributionsSummary>();
  if (resourceIds.length === 0) return medians;
  const placeholders = resourceIds.map(() => '?').join(', ');
  const { results } = await db.prepare(
    `SELECT resource_id, amount_kamas, created_at, device_id, origin FROM community_price_contributions
     WHERE resource_id IN (${placeholders}) AND server_id = ? AND created_at >= ? AND kind = 'resource'
     ORDER BY created_at, rowid`,
  ).bind(...resourceIds, serverId, retentionCutoff()).all<{ resource_id: string; amount_kamas: number; created_at: string; device_id: string; origin: PriceOrigin }>();

  const byResource = new Map<string, ContributionRow[]>();
  for (const row of results) {
    const rows = byResource.get(row.resource_id) ?? [];
    rows.push({ amountKamas: row.amount_kamas, createdAt: row.created_at, deviceId: row.device_id, origin: row.origin });
    byResource.set(row.resource_id, rows);
  }
  for (const [resourceId, rows] of byResource) {
    const median = summarizeContributions(rows);
    if (median) medians.set(resourceId, median);
  }
  return medians;
}

// GET /community-prices (contracts/community-prices.md).
export async function communityPricesResponse(db: ContributionDb, url: URL): Promise<{ status: number; body: unknown }> {
  const serverId = url.searchParams.get('serverId');
  const resourceIds = [...new Set((url.searchParams.get('resourceIds') ?? '').split(',').map((id) => id.trim()).filter(Boolean))];
  if (!serverId || resourceIds.length === 0 || resourceIds.length > MAX_BATCH_RESOURCE_IDS) {
    return { status: 400, body: { error: `serverId and 1 to ${MAX_BATCH_RESOURCE_IDS} resourceIds are required` } };
  }
  const medians = await fetchCurrentMedians(db, resourceIds, serverId);
  const external = await readExternalPrices(db, serverId, resourceIds);
  return {
    status: 200,
    body: {
      serverId,
      prices: resourceIds.flatMap((resourceId) => {
        const median = withExternalPrice(medians.get(resourceId), external.get(resourceId));
        return median ? [{ resourceId, ...median }] : [];
      }),
    },
  };
}

// FR-010 (specs/004): no player-identifying data is ever stored — deviceId is an anonymous,
// client-generated identifier. specs/007 FR-009 / specs/016 FR-012: the reference this contribution
// is compared against (the community median for a resource, the latest shared price for an item) and
// the resulting deviation are resolved here, never trusted from the client, before the insert.
export async function insertContribution(db: ContributionDb, contribution: Contribution): Promise<string> {
  const { resourceId, serverId, kind } = contribution;
  const reference = kind === 'item'
    ? await readLatestContribution(db, resourceId, serverId).then((latest) =>
      (latest ? { medianAmountKamas: latest.amountKamas } : undefined))
    : await fetchCurrentMedian(db, resourceId, serverId);
  const { id, statement } = contributionInsert(db, contribution, reference);
  await statement.run();
  return id;
}

// The insert itself, given the reference already resolved by the caller. specs/056: shared with
// POST /community-price/batch, which reads the medians of a whole batch at once (fetchCurrentMedians)
// and runs every insert in one db.batch.
export function contributionInsert<S>(
  db: { prepare(sql: string): { bind(...values: unknown[]): S } },
  contribution: Contribution,
  reference: { medianAmountKamas: number } | undefined,
): { id: string; statement: S } {
  const { resourceId, serverId, amountKamas, deviceId, kind, origin, itemType } = contribution;
  const { medianAtSubmissionKamas, deviationPercent } = resolveOutlierFields(amountKamas, reference);
  const id = crypto.randomUUID();
  const statement = db.prepare(
    `INSERT INTO community_price_contributions (id, resource_id, server_id, amount_kamas, device_id, median_at_submission_kamas, deviation_percent, kind, origin, item_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, resourceId, serverId, Math.round(amountKamas), deviceId, medianAtSubmissionKamas, deviationPercent, kind, origin, itemType ?? null);
  return { id, statement };
}
