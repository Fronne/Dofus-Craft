import { KAMAS_ICON_URL, formatKamasInput, isValidKamas, normalizeKamasInput } from '../../domain/kamas';

export function MarketPriceInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const valid = isValidKamas(value);
  return (
    <div className="market" data-tour="market-price">
      {/* The "Prix HDV" label lives in RecherchePage, above this input and the profitability
          summary shown next to it, so both can be vertically centered against the input itself
          instead of against the label+input block. It still targets #market-price-input via
          htmlFor, so the association (and screen.getByLabelText('Prix HDV')) holds regardless
          of where it sits in the DOM. */}
      <span className="kamas-input-wrap">
        <input
          id="market-price-input"
          inputMode="numeric"
          aria-invalid={!valid}
          value={formatKamasInput(value)}
          onChange={(event) => onChange(normalizeKamasInput(event.target.value))}
          placeholder="Prix en kamas"
        />
        {value && <img src={KAMAS_ICON_URL} alt="kamas" className="kamas-input-suffix" width={18} height={18} />}
      </span>
      {!valid && <em>Entrez un nombre entier positif ou zéro.</em>}
    </div>
  );
}
