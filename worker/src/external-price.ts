import type { ContributionsSummary } from './median';

// specs/045-restore-production-worker: prices read from an outside source, kept in `external_prices`
// beside what the players share. Huzounet (huzounet.fr) is the only source; src/huzounet.ts fills the table.
export const HUZOUNET_SOURCE = 'huzounet';

// The D1 calls the external prices need, typed structurally so these modules also compile in the app's
// own test setup, which doesn't load the Workers types (D1Database is assignable to it).
export type ExternalStatement = {
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
};
export type ExternalDb = {
  prepare(sql: string): ExternalStatement & { bind(...values: unknown[]): ExternalStatement };
  batch(statements: ExternalStatement[]): Promise<unknown>;
};

export type ExternalPrice = { unitPriceKamas: number; observedAt: string; provisional: boolean; stale: boolean };

type ExternalPriceRow = { resource_id: string; unit_price_kamas: number; observed_at: string; provisional: number; stale: number };

type ExternalReadDb = { prepare(sql: string): { bind(...values: unknown[]): { all<T>(): Promise<{ results: T[] }> } } };

export async function readExternalPrices(db: ExternalReadDb, serverId: string, resourceIds: string[]): Promise<Map<string, ExternalPrice>> {
  const prices = new Map<string, ExternalPrice>();
  if (resourceIds.length === 0) return prices;
  const { results } = await db.prepare(
    `SELECT resource_id, unit_price_kamas, observed_at, provisional, stale FROM external_prices
     WHERE source = ? AND server_id = ? AND resource_id IN (${resourceIds.map(() => '?').join(', ')})`,
  ).bind(HUZOUNET_SOURCE, serverId, ...resourceIds).all<ExternalPriceRow>();
  for (const row of results) {
    prices.set(row.resource_id, { unitPriceKamas: row.unit_price_kamas, observedAt: row.observed_at, provisional: row.provisional === 1, stale: row.stale === 1 });
  }
  return prices;
}

// specs/035: for a price read from Huzounet, whether its source calls it provisional or old.
export type ExternalSummary = Omit<ContributionsSummary, 'latestOrigin'> & {
  latestOrigin: ContributionsSummary['latestOrigin'] | 'external';
  latestFragile?: 'stale' | 'provisional';
};

// The most recent price wins: an external price replaces the latest shared one only when it was observed
// after it. With no shared price at all, the external one stands alone (no median, no sample).
export function withExternalPrice(summary: ContributionsSummary | undefined, external: ExternalPrice | undefined): ExternalSummary | undefined {
  if (!external) return summary;
  const latest = {
    latestAmountKamas: external.unitPriceKamas,
    latestContributionAt: external.observedAt,
    latestOrigin: 'external' as const,
    ...(external.stale ? { latestFragile: 'stale' as const } : external.provisional ? { latestFragile: 'provisional' as const } : {}),
  };
  if (!summary) return { medianAmountKamas: 0, sampleSize: 0, ...latest } as ExternalSummary;
  return external.observedAt > summary.latestContributionAt ? { ...summary, ...latest } : summary;
}
