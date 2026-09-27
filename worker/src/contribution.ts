import { summarizeContributions } from './median';
import { retentionCutoff } from './retention';
import { resolveOutlierFields } from './outlier';
import { readLatestContribution } from './latest';

// Upper bound for a single contribution: the in-game kamas cap. Anything above can only be a typo
// or an abusive request, and would never be a real price.
export const MAX_AMOUNT_KAMAS = 2_000_000_000;

// specs/016: 'item' for an item's shared HDV price, 'resource' (the default, and every row before
// this feature) for a resource price.
export type ContributionKind = 'resource' | 'item';
export type Contribution = { resourceId: string; serverId: string; amountKamas: number; deviceId: string; kind: ContributionKind };

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
  };
}

// specs/007-outlier-confirmation: the median a resource contribution is compared against, from the
// exact same query and aggregation as a plain read — never a separately-maintained calculation.
export async function fetchCurrentMedian(
  db: ContributionDb,
  resourceId: string,
  serverId: string,
): Promise<{ medianAmountKamas: number; sampleSize: number; lastContributionAt: string } | undefined> {
  const { results } = await db.prepare(
    `SELECT amount_kamas, created_at, device_id FROM community_price_contributions
     WHERE resource_id = ? AND server_id = ? AND created_at >= ? AND kind = 'resource'`,
  ).bind(resourceId, serverId, retentionCutoff()).all<{ amount_kamas: number; created_at: string; device_id: string }>();

  return summarizeContributions(results.map((row) => ({
    amountKamas: row.amount_kamas,
    createdAt: row.created_at,
    deviceId: row.device_id,
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
): Promise<Map<string, { medianAmountKamas: number; sampleSize: number; lastContributionAt: string }>> {
  const medians = new Map<string, { medianAmountKamas: number; sampleSize: number; lastContributionAt: string }>();
  if (resourceIds.length === 0) return medians;
  const placeholders = resourceIds.map(() => '?').join(', ');
  const { results } = await db.prepare(
    `SELECT resource_id, amount_kamas, created_at, device_id FROM community_price_contributions
     WHERE resource_id IN (${placeholders}) AND server_id = ? AND created_at >= ? AND kind = 'resource'`,
  ).bind(...resourceIds, serverId, retentionCutoff()).all<{ resource_id: string; amount_kamas: number; created_at: string; device_id: string }>();

  const byResource = new Map<string, { amountKamas: number; createdAt: string; deviceId: string }[]>();
  for (const row of results) {
    const rows = byResource.get(row.resource_id) ?? [];
    rows.push({ amountKamas: row.amount_kamas, createdAt: row.created_at, deviceId: row.device_id });
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
  return {
    status: 200,
    body: {
      serverId,
      prices: resourceIds.flatMap((resourceId) => {
        const median = medians.get(resourceId);
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
  const { resourceId, serverId, amountKamas, deviceId, kind } = contribution;
  const reference = kind === 'item'
    ? await readLatestContribution(db, resourceId, serverId).then((latest) =>
      (latest ? { medianAmountKamas: latest.amountKamas } : undefined))
    : await fetchCurrentMedian(db, resourceId, serverId);
  const { medianAtSubmissionKamas, deviationPercent } = resolveOutlierFields(amountKamas, reference);
  const id = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO community_price_contributions (id, resource_id, server_id, amount_kamas, device_id, median_at_submission_kamas, deviation_percent, kind) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, resourceId, serverId, Math.round(amountKamas), deviceId, medianAtSubmissionKamas, deviationPercent, kind).run();
  return id;
}
