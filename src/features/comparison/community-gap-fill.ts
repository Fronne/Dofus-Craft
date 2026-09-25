import type { ResourcePrice, ServerId } from '../../domain/types';
import { lookupCommunityMedian } from './useCommunityPrice';

// Mode communautaire: for every resource in `resourceIds` with no carnet entry yet, fetch its
// community median and hand it to `saveMedian` — once, never over an existing price. The caller
// decides how it's written (the Suivis page straight into the repository, the item detail through
// its own price hook so the lines refresh). Shared so both pages count the same prices, including
// resources whose line isn't displayed (specs/015, research.md §7). A saved price that comes back
// is also put into `prices`, so the caller can recompute right away. Returns whether any was saved.
export async function fillCommunityGaps(
  serverId: ServerId,
  resourceIds: string[],
  prices: Record<string, ResourcePrice>,
  saveMedian: (resourceId: string, median: number) => Promise<ResourcePrice | void>,
  isCancelled: () => boolean,
): Promise<boolean> {
  let saved = false;
  await Promise.all(resourceIds.filter((resourceId) => !prices[resourceId]).map(async (resourceId) => {
    const median = await lookupCommunityMedian(resourceId, serverId);
    if (median === undefined || isCancelled() || prices[resourceId]) return;
    const price = await saveMedian(resourceId, median);
    if (price) prices[resourceId] = price;
    saved = true;
  }));
  return saved;
}
