import { fetchCurrentMedian } from '../contribution';
import { readExternalPrices, withExternalPrice } from '../external-price';
import type { Env } from '../index';

export async function communityPriceResponse(url: URL, env: Env): Promise<{ status: number; body: unknown }> {
  const resourceId = url.searchParams.get('resourceId');
  const serverId = url.searchParams.get('serverId');
  if (!resourceId || !serverId) return { status: 400, body: { error: 'resourceId and serverId are required' } };

  const external = (await readExternalPrices(env.DB, serverId, [resourceId])).get(resourceId);
  const median = withExternalPrice(await fetchCurrentMedian(env.DB, resourceId, serverId), external);
  // FR-002: no row at all — never a fabricated price — when nothing (or nothing valid after
  // FR-012's outlier filtering) remains.
  if (!median) return { status: 404, body: null };

  return {
    status: 200,
    body: {
      resourceId,
      serverId,
      medianAmountKamas: median.medianAmountKamas,
      sampleSize: median.sampleSize,
      lastContributionAt: median.lastContributionAt,
      // specs/024-latest-community-price: the price the site shows (contracts/community-price-api.md).
      latestAmountKamas: median.latestAmountKamas,
      latestContributionAt: median.latestContributionAt,
      // specs/025-rune-purchase-import: the origin of that latest price (contracts/fm-site-api.md).
      latestOrigin: median.latestOrigin,
      // specs/035: for a price read from Huzounet, whether its source calls it provisional or old.
      latestFragile: median.latestFragile,
      // specs/082-auteur-prix-communautaires: the pseudonym of that latest price's author, when it has one and is public.
      latestAuthor: median.latestAuthor,
    },
  };
}
