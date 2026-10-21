import { useState } from 'react';
import { isRollAllowed } from '../../domain/brisage';

// specs/066-exo-brisage (US1, US3): adds an exo — a stat the item does not have by default — to the item.
// The choices and the weight limit of each stat come from the page; this form only checks what was typed.

export type ExoChoice = { effectId: number; label: string; max: number };

export function ExoAdder({ choices, onAdd }: { choices: ExoChoice[]; onAdd: (effectId: number, value: number) => void }) {
  const [effectText, setEffectText] = useState('');
  const [valueText, setValueText] = useState('');
  const [invalid, setInvalid] = useState(false);
  const chosen = choices.find((choice) => String(choice.effectId) === effectText) ?? choices[0];
  if (!chosen) return null;

  const submit = () => {
    const value = valueText.trim() === '' ? NaN : Number(valueText.replace(',', '.'));
    if (!isRollAllowed(value, chosen.max, { exo: true })) {
      setInvalid(true);
      return;
    }
    onAdd(chosen.effectId, value);
    setValueText('');
    setInvalid(false);
  };

  return (
    <form className="brisage-exo-form" noValidate onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <label>
        Exo
        <select value={String(chosen.effectId)} onChange={(event) => { setEffectText(event.target.value); setInvalid(false); }}>
          {choices.map((choice) => <option key={choice.effectId} value={choice.effectId}>{choice.label}</option>)}
        </select>
      </label>
      <label>
        Valeur
        <input
          type="number" inputMode="numeric" min={1} max={chosen.max} step={1}
          aria-label="Valeur de l'exo" aria-invalid={invalid || undefined}
          value={valueText} onChange={(event) => { setValueText(event.target.value); setInvalid(false); }}
        />
      </label>
      <button type="submit" className="btn btn-secondary">Ajouter un exo</button>
      <p className={`brisage-exo-hint fm-note${invalid ? ' fm-error' : ''}`} role={invalid ? 'alert' : undefined}>
        {invalid
          ? `Valeur invalide : un entier de 1 à ${chosen.max} (poids maximal 101).`
          : `Maximum ${chosen.max} pour ${chosen.label} (poids maximal 101). Calcul estimé, repris de DoFocus : l'exo compte comme une ligne de plus, sans focus possible.`}
      </p>
    </form>
  );
}
