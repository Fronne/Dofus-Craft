import { useEffect, useRef, useState } from 'react';
import type { LatestMention } from '../../domain/huzounet-load';
import type { PriceMode } from '../../domain/price-modes';
import { getCommunityPrices } from '../../services/community-price-api';

// specs/025 FR-011, specs/026 FR-006: the origin of each item's latest shared price, in Mode
// communautaire only (nothing is shared in Mode personnel). A price without origin — an older Worker,
// or a manual entry — is a manual entry. `version` rereads it after a price is saved on the page.
// specs/046-hdv-huzounet-load: it now serves the displayed lines of every tab, with the date of that
// price and what Huzounet says of it. Lines join as the player scrolls, so only the items not asked
// yet are requested.
export function useLatestOrigins(serverId: string | undefined, priceMode: PriceMode, ids: string[], version: number): Record<string, LatestMention> {
  const [origins, setOrigins] = useState<Record<string, LatestMention>>({});
  // What was already asked, and for which server and version: another context starts over.
  const asked = useRef<{ context: string; ids: Set<string> }>({ context: '', ids: new Set() });
  const key = ids.join(',');

  useEffect(() => {
    const context = `${serverId ?? ''}:${priceMode}:${version}`;
    const startsOver = asked.current.context !== context;
    if (startsOver) asked.current = { context, ids: new Set() };
    if (!serverId || priceMode !== 'community' || !key) {
      if (startsOver) setOrigins({});
      return;
    }
    const known = asked.current.ids;
    const missing = key.split(',').filter((id) => !known.has(id));
    if (missing.length === 0) return;
    for (const id of missing) known.add(id);
    void getCommunityPrices(missing, serverId).then((lookup) => {
      if (asked.current.context !== context) return;
      if (lookup.status !== 'found') {
        for (const id of missing) known.delete(id);
        return;
      }
      const found: Record<string, LatestMention> = {};
      for (const price of lookup.prices) {
        found[price.resourceId] = { origin: price.latestOrigin ?? 'manual', fragile: price.latestFragile, contributedAt: price.latestContributionAt };
      }
      // A reread replaces what it asked for: an item that lost its price loses its mention too.
      setOrigins((current) => {
        const next = { ...current };
        for (const id of missing) delete next[id];
        return { ...next, ...found };
      });
    });
  }, [serverId, priceMode, key, version]);

  return origins;
}
