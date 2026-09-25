import { KAMAS_ICON_URL, formatKamasInput, isValidKamas, normalizeKamasInput } from '../../domain/kamas';

export function MarketPriceInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const valid = isValidKamas(value);
  return (
    <div className="market" data-tour="market-price">
      {/* The "Prix HDV" label lives in RecherchePage, next to this input on the HDV row of the
          comparison. It targets #market-price-input via htmlFor, so the association (and
          screen.getByLabelText('Prix HDV')) holds regardless of where it sits in the DOM. */}
      <span className="kamas-input-wrap">
        <input
          id="market-price-input"
          inputMode="numeric"
          aria-invalid={!valid}
          value={formatKamasInput(value)}
          onChange={(event) => onChange(normalizeKamasInput(event.target.value))}
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
      {!valid && <em>Entrez un nombre entier positif ou zéro.</em>}
    </div>
  );
}
