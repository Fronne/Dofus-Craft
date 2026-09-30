import { useEffect, useState } from 'react';
import type { PriceOrigin } from '../../domain/forgemagie';
import type { PriceMode } from '../../domain/price-modes';
import { getCommunityPrices } from '../../services/community-price-api';

// specs/025 FR-011, specs/026 FR-006: the origin of each item's latest shared price, in Mode
// communautaire only (nothing is shared in Mode personnel). A price without origin — an older Worker,
// or a manual entry — is a manual entry. `version` rereads it after a price is saved on the page.
export function useLatestOrigins(serverId: string | undefined, priceMode: PriceMode, ids: string[], version: number): Record<string, PriceOrigin> {
  const [origins, setOrigins] = useState<Record<string, PriceOrigin>>({});
  const key = ids.join(',');

  useEffect(() => {
    if (!serverId || priceMode !== 'community' || !key) {
      setOrigins({});
      return;
    }
    let cancelled = false;
    void getCommunityPrices(key.split(','), serverId).then((lookup) => {
      if (cancelled || lookup.status !== 'found') return;
      setOrigins(Object.fromEntries(lookup.prices.map((price) => [price.resourceId, price.latestOrigin ?? 'manual'])));
    });
    return () => {
      cancelled = true;
    };
  }, [serverId, priceMode, key, version]);

  return origins;
}
