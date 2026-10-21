import { useEffect, useRef, useState } from 'react';
import { isRollAllowed } from '../../domain/brisage';
import type { RuneYield } from '../../domain/brisage';
import { Kamas } from '../prices/PricesPage';

// specs/066-exo-brisage (US1, US3): a line of the table for an exo. A new exo starts without a rune; the player picks
// it in a list that shows each rune's icon, then types the value. The page owns the data and the weight limit.

export type ExoRuneChoice = { effectId: number; label: string; runeName: string; imageUrl?: string; max: number };
/** `id` is local and stable (the row keeps its identity, and its focus, when its rune is picked); it is not stored. */
export type ExoEntry = { id: string; effectId?: number; value: number };

const number = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

function RuneIcon({ choice }: { choice: ExoRuneChoice }) {
  return choice.imageUrl
    ? <img src={choice.imageUrl} alt="" width="28" height="28" className="brisage-exo-icon" />
    : <span className="result-image-fallback brisage-exo-icon" aria-hidden="true">{choice.runeName.replace('Rune ', '').slice(0, 1)}</span>;
}

/** The rune of the exo, picked in a list with the icon of every rune. */
function RunePicker({ chosen, choices, onPick }: { chosen?: ExoRuneChoice; choices: ExoRuneChoice[]; onPick: (effectId: number) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => { setOpen(false); trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => { if (!box.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [open]);

  return (
    <span className="brisage-exo-picker" ref={box} onKeyDown={(event) => { if (event.key === 'Escape' && open) close(); }}>
      <button
        ref={trigger} type="button" className="brisage-exo-pick" aria-expanded={open}
        aria-label={chosen ? `Rune de l'exo : ${chosen.runeName}` : "Choisir la rune de l'exo"}
        onClick={() => setOpen(!open)}
      >
        {chosen ? <><RuneIcon choice={chosen} /><span>{chosen.runeName}</span></> : <span>Choisir une rune</span>}
      </button>
      {open && (
        <ul className="brisage-exo-options" aria-label="Runes disponibles pour l'exo">
          {choices.map((choice) => (
            <li key={choice.effectId} aria-current={choice.effectId === chosen?.effectId || undefined}>
              <button type="button" onClick={() => { onPick(choice.effectId); close(); }}>
                <RuneIcon choice={choice} />
                <span>{choice.runeName}</span>
                <span className="fm-note">{choice.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}

export function ExoRow({ entry, choices, plain, onPick, onValue, onRemove }: {
  entry: ExoEntry;
  /** The runes this line may take: its own and the ones not used yet. */
  choices: ExoRuneChoice[];
  /** What the normal breaking gives for this line, once its rune is picked. */
  plain: RuneYield | undefined;
  onPick: (effectId: number) => void;
  onValue: (value: number) => void;
  onRemove: () => void;
}) {
  const chosen = choices.find((choice) => choice.effectId === entry.effectId);
  const [text, setText] = useState(String(entry.value));
  const [invalid, setInvalid] = useState(false);
  // A rune with a lower limit brings the value back under it (or the page changed the value).
  useEffect(() => { setText(String(entry.value)); setInvalid(false); }, [entry.value, entry.effectId]);

  const type = (next: string) => {
    setText(next);
    const value = next.trim() === '' ? NaN : Number(next.replace(',', '.'));
    if (chosen && isRollAllowed(value, chosen.max, { exo: true })) {
      setInvalid(false);
      onValue(value);
    } else {
      setInvalid(true);
    }
  };

  return (
    <tr role="row" className="brisage-line--exo">
      <th scope="row" role="rowheader" data-label="Rune">
        <span className="brisage-line-name" title={chosen?.label}>
          <button type="button" className="brisage-exo-remove" aria-label={`Retirer l'exo${chosen ? ` ${chosen.label}` : ''}`} onClick={onRemove} title="Retirer l'exo">
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false"><path d="M2 2l8 8M10 2l-8 8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
          </button>
          <RunePicker chosen={chosen} choices={choices} onPick={onPick} />
          <span className="brisage-badge brisage-badge--exo">Exo</span>
        </span>
      </th>
      <td role="cell" data-label="Jet de l'exo">
        {/* Same layout as the roll of the other lines: lowest value, the field, highest value. */}
        <span className="brisage-jet">
          <span className="brisage-bound">{chosen ? 1 : ''}</span>
          <input
            type="number" inputMode="numeric" min={1} max={chosen?.max} step={1}
            className="brisage-roll brisage-exo-value"
            aria-label={`Valeur de l'exo${chosen ? ` ${chosen.label}` : ''}`}
            aria-invalid={invalid || undefined} disabled={!chosen}
            value={text} onChange={(event) => type(event.target.value)}
          />
          <span className="brisage-bound" title="Poids maximal 101">{chosen?.max ?? ''}</span>
        </span>
        {(!chosen || invalid) && (
          <span className="brisage-exo-state fm-note" role={invalid ? 'alert' : undefined}>
            {!chosen ? 'choisissez une rune' : `de 1 à ${chosen.max} (poids max 101)`}
          </span>
        )}
      </td>
      <td role="cell" data-label="Prix de la rune">{!chosen ? '—' : plain?.unitPriceKamas !== undefined ? <Kamas value={plain.unitPriceKamas} /> : <span className="fm-note">prix manquant</span>}</td>
      <td role="cell" data-label="Sans focus : runes">{plain ? number.format(Math.round(plain.count)) : '—'}</td>
      <td role="cell" data-label="Sans focus : valeur des runes">{plain?.valueKamas !== undefined ? <Kamas value={Math.round(plain.valueKamas)} /> : <span className="fm-note">—</span>}</td>
      <td role="cell" data-label="Focus : runes" title="Pas de focus possible sur un exo">—</td>
      <td role="cell" data-label="Focus : valeur des runes" title="Pas de focus possible sur un exo">—</td>
    </tr>
  );
}
