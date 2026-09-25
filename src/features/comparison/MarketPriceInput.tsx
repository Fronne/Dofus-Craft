import { useRef, useState } from 'react';
import { KAMAS_ICON_URL, formatKamasInput, isValidKamas, normalizeKamasInput } from '../../domain/kamas';
import { formatRelativeTime } from '../../domain/time';
import { classifyPriceAge } from '../../domain/price-age';
import { Icon } from '../../components/Icon';

export function MarketPriceInput({
  value,
  onChange,
  lockWhenFilled,
  updatedAt,
  onCommit,
}: {
  value: string;
  onChange: (value: string) => void;
  // specs/016 (Mode communautaire): the field holds the group's latest shared price, so — like a
  // resource price there — it starts read-only once filled and needs the edit button to change,
  // re-locking on blur. Omitted in Mode personnel, where it stays a plain field.
  lockWhenFilled?: boolean;
  // specs/016 FR-002: date of the latest shared price, shown under the field (no contribution count).
  updatedAt?: string;
  // specs/016: called on blur only after an actual edit — never for a plain focus/blur of the locked
  // field — with the typed value; resolving to 'rejected' (e.g. a canceled confirmation) puts the
  // previous value back.
  onCommit?: (value: string) => Promise<'accepted' | 'rejected' | void>;
}) {
  const valid = isValidKamas(value);
  const [editing, setEditing] = useState(false);
  const locked = Boolean(lockWhenFilled) && Boolean(value) && !editing;
  const inputRef = useRef<HTMLInputElement>(null);
  const lastCommittedValueRef = useRef(value);
  const priceAge = classifyPriceAge(updatedAt);
  const ageClass = priceAge === 'stale' ? ' market-date--stale' : priceAge === 'expired' ? ' market-date--expired' : '';
  return (
    <div className="market" data-tour="market-price">
      {/* The "Prix HDV" label lives in RecherchePage, next to this input on the HDV row of the
          comparison. It targets #market-price-input via htmlFor, so the association (and
          screen.getByLabelText('Prix HDV')) holds regardless of where it sits in the DOM. */}
      <span className="kamas-input-wrap">
        <input
          id="market-price-input"
          ref={inputRef}
          inputMode="numeric"
          aria-invalid={!valid}
          value={formatKamasInput(value)}
          onChange={(event) => {
            // First keystroke of an edit session: remember the value it started from (see
            // ResourcePriceInput, same no-op and revert guards).
            if (lockWhenFilled && !editing) lastCommittedValueRef.current = value;
            if (lockWhenFilled) setEditing(true);
            onChange(normalizeKamasInput(event.target.value));
          }}
          onBlur={() => {
            if (!lockWhenFilled) return;
            setEditing(false);
            // Only a real edit session can commit: focusing the locked field alone must not.
            if (!editing || value === lastCommittedValueRef.current) return;
            const previousValue = lastCommittedValueRef.current;
            const result = onCommit?.(value);
            if (result) {
              void result.then((outcome) => {
                if (outcome === 'rejected') onChange(previousValue);
              });
            }
          }}
          // Only a placeholder: an actual 0 would count as a real HDV price and skew the verdict.
          placeholder="0"
          readOnly={locked}
        />
        {!locked && (
          // Always shown, faded until a price is typed, so the field reads as an amount in kamas.
          <img
            src={KAMAS_ICON_URL}
            alt="kamas"
            className={`kamas-input-suffix${value ? '' : ' kamas-input-suffix--empty'}`}
            width={18}
            height={18}
          />
        )}
        {locked && (
          <button
            type="button"
            className="kamas-input-edit-button"
            aria-label="Modifier ce prix"
            onClick={(event) => {
              event.preventDefault();
              lastCommittedValueRef.current = value;
              setEditing(true);
              inputRef.current?.focus();
            }}
          >
            <Icon name="edit" size={14} />
          </button>
        )}
      </span>
      {updatedAt && <small className={`market-date${ageClass}`}>Dernière mise à jour : {formatRelativeTime(updatedAt)}</small>}
      {!valid && <em>Entrez un nombre entier positif ou zéro.</em>}
    </div>
  );
}
