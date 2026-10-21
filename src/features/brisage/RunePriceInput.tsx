import { useRef, useState } from 'react';
import { formatKamasInput, KAMAS_ICON_URL, parseKamas } from '../../domain/kamas';
import { computeDeviationPercent, OUTLIER_THRESHOLD_PERCENT } from '../../domain/outlier-threshold';
import type { PriceMode } from '../../domain/price-modes';
import { resourcePricesFor } from '../../persistence/resource-prices-for-mode';
import { submitCommunityPrice } from '../../services/community-price-api';
import { useOutlierConfirm } from '../comparison/OutlierConfirmDialog';
import { lookupCommunityPrice } from '../comparison/useCommunityPrice';

// specs/067 (histoire 5): the unit price of a rune is typed right in the table. It goes to the carnet of the active mode;
// in Mode communautaire it is also shared with the group, after the same outlier confirmation as the other pages
// (specs/007), so a mistyped price is not published unchecked.

export function RunePriceInput({ runeId, runeName, serverId, priceMode, price, onSaved }: {
  runeId: string;
  runeName: string;
  serverId: string;
  priceMode: PriceMode;
  /** The price in use, if any. */
  price: number | undefined;
  /** Called with the price once it is saved, so the table recomputes at once. */
  onSaved: (runeId: string, price: number) => void;
}) {
  const [typed, setTyped] = useState<string>();
  const [dialog, confirmOutlier] = useOutlierConfirm();
  const value = typed ?? (price !== undefined && price > 0 ? formatKamasInput(String(price)) : '');

  // A commit waits for the shared price and the confirmation: a second blur meanwhile must not save or share twice.
  const busy = useRef(false);
  const commit = async () => {
    if (typed === undefined || busy.current) return;
    const amount = parseKamas(typed);
    // An emptied or zero field is not a price: the price in use comes back.
    if (amount === undefined || !(amount > 0) || amount === price) { setTyped(undefined); return; }
    busy.current = true;
    try {
      if (priceMode === 'community') {
        const shared = await lookupCommunityPrice(runeId, serverId);
        if (shared && shared.sampleSize > 0) {
          const deviationPercent = computeDeviationPercent(amount, shared.medianAmountKamas);
          if (deviationPercent > OUTLIER_THRESHOLD_PERCENT) {
            const confirmed = await confirmOutlier({ medianAmountKamas: shared.medianAmountKamas, enteredAmountKamas: amount, deviationPercent });
            if (!confirmed) { setTyped(undefined); return; }
          }
        }
      }
      await resourcePricesFor(priceMode).save(serverId, runeId, amount);
      onSaved(runeId, amount);
      setTyped(undefined);
      if (priceMode === 'community') void submitCommunityPrice(runeId, serverId, amount);
    } finally {
      busy.current = false;
    }
  };

  return (
    <>
      <span className="kamas-input-wrap brisage-price-wrap">
        <input
          type="text" inputMode="numeric" className="brisage-price-input" placeholder="prix"
          aria-label={`Prix de ${runeName}`}
          value={value}
          onChange={(event) => setTyped(formatKamasInput(event.target.value))}
          onBlur={() => { void commit(); }}
          onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
        />
        {value && <img src={KAMAS_ICON_URL} alt="kamas" className="kamas-input-suffix" width={18} height={18} />}
      </span>
      {price === undefined && <span className="fm-note brisage-price-missing">prix manquant</span>}
      {dialog}
    </>
  );
}
