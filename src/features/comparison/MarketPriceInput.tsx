import { formatKamasInput, isValidKamas, normalizeKamasInput } from '../../domain/kamas';

export function MarketPriceInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const valid = isValidKamas(value);
  return (
    <label className="market">
      Prix HDV observé
      <input
        inputMode="numeric"
        aria-invalid={!valid}
        value={formatKamasInput(value)}
        onChange={(event) => onChange(normalizeKamasInput(event.target.value))}
        placeholder="Prix en kamas"
      />
      {!valid && <em>Entrez un nombre entier positif ou zéro.</em>}
    </label>
  );
}
