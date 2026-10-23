import { useEffect, useState } from 'react';
import { getSharedCoefficients, MAX_ITEMS_PER_READ, type SharedCoefficient } from '../../services/brisage-coefficient-api';
import { latestCoefficient, type StoredCoefficient } from '../../persistence/brisage-coefficients';

// specs/069-coefficients-brisage-partages (FR-002, FR-009): the coefficients noted by other players, read once per
// item and server while the site stays open (null = nobody noted one). A failed read is not remembered, so it is
// tried again; meanwhile the coefficient kept on the device is all there is.
const known = new Map<string, SharedCoefficient | null>();

/** Gives, for an item, the more recent of the coefficient kept on the device and the shared one. */
export function useSharedCoefficients(serverId: string | undefined, itemIds: string[]): (itemId: string, local: StoredCoefficient | undefined) => StoredCoefficient | undefined {
  const [, setVersion] = useState(0);
  const wanted = serverId ? itemIds.filter((id) => !known.has(`${serverId}:${id}`)) : [];
  const wantedKey = wanted.join(',');
  useEffect(() => {
    if (!serverId || !wantedKey) return;
    let active = true;
    const ids = wantedKey.split(',');
    (async () => {
      for (let start = 0; start < ids.length; start += MAX_ITEMS_PER_READ) {
        const chunk = ids.slice(start, start + MAX_ITEMS_PER_READ);
        const found = await getSharedCoefficients(serverId, chunk);
        if (!found) continue;
        for (const id of chunk) known.set(`${serverId}:${id}`, found.get(id) ?? null);
        if (active) setVersion((version) => version + 1);
      }
    })();
    return () => { active = false; };
  }, [serverId, wantedKey]);
  return (itemId, local) => latestCoefficient(local, serverId ? known.get(`${serverId}:${itemId}`) ?? undefined : undefined);
}

/** The coefficient of an item was cleared: the shared one that was read is no longer shown. */
export function dropSharedCoefficient(serverId: string, itemId: string): void {
  known.set(`${serverId}:${itemId}`, null);
}

/** Forgets what was read (tests). */
export function forgetSharedCoefficients(): void {
  known.clear();
}
