import type { ReactNode } from 'react';
import { KAMAS_ICON_URL, formatKamasInput, isValidKamas } from '../../domain/kamas';
import { formatRelativeTime } from '../../domain/time';
import { classifyPriceAge } from '../../domain/price-age';
import { usePriceEntry } from './usePriceEntry';

export function MarketPriceInput({
  value,
  onChange,
  updatedAt,
  onCommit,
  onUnloadCommit,
  onTypingChange,
  history,
}: {
  value: string;
  onChange: (value: string) => void;
  // specs/016 FR-002: date of the latest shared price, shown under the field (no contribution count).
  updatedAt?: string;
  // specs/016 (Mode communautaire): called on blur only after an actual edit — never for a plain
  // focus/blur — with the typed value; resolving to 'rejected' (e.g. a canceled confirmation) puts
  // the previous value back. Omitted in Mode personnel.
  onCommit?: (value: string) => Promise<'accepted' | 'rejected' | void>;
  // specs/052-direct-price-entry (FR-008/FR-009): the page unloads with a typed price not shared
  // yet — shared then, without any confirmation.
  onUnloadCommit?: (value: string) => void;
  // True while the player is typing in the field, false once it is left.
  onTypingChange?: (typing: boolean) => void;
  // specs/017: the price-history button, beside the field. Only passed in Mode communautaire.
  history?: ReactNode;
}) {
  const valid = isValidKamas(value);
  // specs/052-direct-price-entry: same typing behaviour as a resource price (see usePriceEntry).
  const entry = usePriceEntry({ value, onChange, onCommit, onUnloadCommit, onTypingChange });
  const priceAge = classifyPriceAge(updatedAt);
  const ageClass = priceAge === 'stale' ? ' market-date--stale' : priceAge === 'expired' ? ' market-date--expired' : '';
  const field = (
    <span className="kamas-input-wrap">
      <input
        id="market-price-input"
        inputMode="numeric"
        aria-invalid={!valid}
        aria-describedby={valid ? undefined : 'market-price-error'}
        value={formatKamasInput(value)}
        onFocus={entry.onFocus}
        onMouseUp={entry.onMouseUp}
        onKeyDown={entry.onKeyDown}
        onChange={(event) => entry.onChange(event.target.value)}
        onBlur={entry.onBlur}
        // Only a placeholder: an actual 0 would count as a real HDV price and skew the verdict.
        placeholder="0"
      />
      {/* Always shown, faded until a price is typed, so the field reads as an amount in kamas. */}
      <img
        src={KAMAS_ICON_URL}
        alt="kamas"
        className={`kamas-input-suffix${value ? '' : ' kamas-input-suffix--empty'}`}
        width={18}
        height={18}
      />
    </span>
  );

  return (
    <div className="market" data-tour="market-price">
      {/* The "Prix HDV" label lives in RecherchePage, next to this input on the HDV row of the
          comparison. It targets #market-price-input via htmlFor, so the association (and
          screen.getByLabelText('Prix HDV')) holds regardless of where it sits in the DOM. */}
      {history ? <div className="market-input-row">{field}{history}</div> : field}
      {updatedAt && <small className={`market-date${ageClass}`}>Dernière mise à jour : {formatRelativeTime(updatedAt)}</small>}
      {!valid && <em id="market-price-error" role="alert">Entrez un nombre entier positif ou zéro.</em>}
    </div>
  );
}
