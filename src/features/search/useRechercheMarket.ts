import { useEffect, useRef, useState } from 'react';
import type { Item } from '../../domain/types';
import { parseKamas } from '../../domain/kamas';
import { pinnedItemPrices } from '../../persistence/indexeddb-pinned-item-price-repository';
import { useSharedItemPrice } from '../comparison/useSharedItemPrice';
import { useOutlierConfirm } from '../comparison/OutlierConfirmDialog';
import { computeDeviationPercent, needsItemPriceConfirmation } from '../../domain/outlier-threshold';

// The item's HDV price: the device's own in Mode personnel, the group's latest shared one in Mode
// communautaire, with the way each is typed, kept and shared.
export function useRechercheMarket({ serverId, selected, selectedItem, community, reload }: {
  serverId: string | undefined;
  selected: string;
  selectedItem: Item | undefined;
  community: boolean;
  reload: number;
}) {
  const [market, setMarket] = useState('');
  // Mode personnel: the HDV price could not be kept on this device (said under the field).
  const [marketError, setMarketError] = useState('');
  useEffect(() => {
    // specs/016: in Mode communautaire the HDV price is the group's latest shared one (below), never
    // the device's own; Mode personnel reads the local price exactly as before (FR-010).
    if (community) return;
    if (!serverId || !selected) {
      setMarket('');
      return;
    }
    let cancelled = false;
    setMarketError('');
    pinnedItemPrices.get(serverId, selected).then((price) => {
      if (!cancelled) setMarket(price ? String(price.marketPriceKamas) : '');
    }).catch(() => {
      if (!cancelled) setMarket('');
    });
    return () => {
      cancelled = true;
    };
  }, [serverId, selected, community]);
  // specs/016-shared-item-prices: the latest HDV price shared by the group for this item and server.
  // specs/047-recherche-refresh-prices: goes up each time the API has read prices again on request —
  // the shared HDV price, the lines and the resources not on screen then read theirs again.
  const [sharedItemPrice, commitSharedItemPrice] = useSharedItemPrice(community ? selected || undefined : undefined, serverId, reload);
  // Another item or server: start from an empty field, never the previous item's price — its own
  // shared price (or the cached one) fills it in as soon as it's known.
  useEffect(() => {
    if (community) setMarket('');
  }, [community, selected, serverId]);
  // specs/052-direct-price-entry: true from the first keystroke in the HDV field until it is left —
  // a shared price read meanwhile must not replace what the player is typing.
  const marketTypingRef = useRef(false);
  useEffect(() => {
    marketTypingRef.current = false;
  }, [community, selected, serverId]);
  useEffect(() => {
    if (!community || marketTypingRef.current) return;
    if (sharedItemPrice.kind === 'found') setMarket(String(sharedItemPrice.price.amountKamas));
    // Only "nothing shared" empties the field: an unreachable service must never wipe what's shown
    // or what the player just typed (FR-011).
    else if (sharedItemPrice.kind === 'not-found') setMarket('');
  }, [community, sharedItemPrice]);

  // specs/016 US2: shares a validated HDV price in Mode communautaire. The typed value stays shown
  // (and used by the comparison) even if the service can't be reached — for this visit (FR-011).
  // US3: beyond 50 % of the latest price shown, a confirmation first — canceling shares nothing and
  // puts the previous value back (FR-006 to FR-008).
  const [marketOutlierDialog, confirmMarketOutlier] = useOutlierConfirm();
  const commitMarketPrice = async (value: string): Promise<'accepted' | 'rejected' | void> => {
    const amount = parseKamas(value);
    if (amount === undefined) return;
    const latest = sharedItemPrice.kind === 'found' ? sharedItemPrice.price.amountKamas : undefined;
    if (latest !== undefined && needsItemPriceConfirmation(amount, latest)) {
      const confirmed = await confirmMarketOutlier({
        medianAmountKamas: latest,
        enteredAmountKamas: amount,
        deviationPercent: latest === 0 ? Number.POSITIVE_INFINITY : computeDeviationPercent(amount, latest),
        referenceLabel: 'Dernier prix',
      });
      if (!confirmed) return 'rejected';
    }
    await commitSharedItemPrice(amount);
    return 'accepted';
  };
  // specs/052-direct-price-entry (FR-008/FR-009): the page unloads with a typed HDV price not shared
  // yet. No confirmation can be shown then: a price that would need one is left out.
  const commitMarketPriceOnUnload = (value: string) => {
    const amount = parseKamas(value);
    if (amount === undefined) return;
    const latest = sharedItemPrice.kind === 'found' ? sharedItemPrice.price.amountKamas : undefined;
    if (latest !== undefined && needsItemPriceConfirmation(amount, latest)) return;
    void commitSharedItemPrice(amount);
  };
  const onMarketTypingChange = (typing: boolean) => {
    marketTypingRef.current = typing;
  };
  const onMarketChange = (value: string) => {
    setMarket(value);
    // Mode communautaire shares on commit (above), never into the local price.
    if (!community && selectedItem && serverId) {
      const parsed = parseKamas(value);
      const kept = parsed === undefined
        ? pinnedItemPrices.remove(serverId, selectedItem.id)
        : pinnedItemPrices.save(serverId, selectedItem.id, parsed);
      kept.then(() => setMarketError(''), () => setMarketError("Impossible d'enregistrer ce prix sur cet appareil."));
    }
  };

  return {
    market,
    marketError,
    sharedItemPrice,
    marketOutlierDialog,
    commitMarketPrice,
    commitMarketPriceOnUnload,
    onMarketTypingChange,
    onMarketChange,
  };
}
