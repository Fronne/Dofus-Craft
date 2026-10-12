import { useCallback, useEffect, useRef, useState } from 'react';
import type { PriceMode } from '../../domain/price-modes';
import type { ResourcePrice } from '../../domain/types';
import { resourcePricesFor } from '../../persistence/resource-prices-for-mode';

// specs/023-hdv-price-entry (research.md §6): the carnet prices of **every** item of the open tab, in
// one batched read, for the « N objets sur M ont un prix » count and the sorts by price and by
// date (specs/048). Separate from the read of the displayed lines, which only covers what is shown.
// `refresh()` rereads it after a price is saved on the page.
export function useHdvPriceSummary(serverId: string | undefined, priceMode: PriceMode, ids: string[]) {
  const [prices, setPrices] = useState<Record<string, ResourcePrice>>({});
  const [loaded, setLoaded] = useState(false);
  // The read failed: the count and the sorts by price would be wrong, so the page says so instead.
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const generation = useRef(0);
  const key = ids.join(',');

  useEffect(() => {
    generation.current += 1;
    const current = generation.current;
    if (!serverId) {
      setPrices({});
      setLoaded(true);
      return;
    }
    resourcePricesFor(priceMode)
      .getMany(serverId, key ? key.split(',') : [])
      .then((result) => {
        if (generation.current !== current) return;
        setPrices(result);
        setFailed(false);
        setLoaded(true);
      })
      .catch(() => {
        if (generation.current !== current) return;
        setFailed(true);
        setLoaded(true);
      });
  }, [serverId, priceMode, key, version]);

  const refresh = useCallback(() => setVersion((value) => value + 1), []);
  return { prices, loaded, failed, refresh };
}
