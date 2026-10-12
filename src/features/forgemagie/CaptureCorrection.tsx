import { useState } from 'react';
import { correctionValues, unitPriceKamas, type FmSeanceCapture, type FmSeanceDetail } from '../../domain/forgemagie';
import { formatKamas } from '../../domain/kamas';
import { correctFmCapture } from '../../services/fm-api';
import { Kamas } from '../prices/PricesPage';

// specs/049-fm-seances (US3): correct a capture the reading got wrong — the quantity and the total of
// each line. What was read stays known, and can be put back.

const quantityFormat = new Intl.NumberFormat('fr-FR');

type Typed = { quantity: string; total: string };

export function CaptureCorrection({ capture, onCancel, onSaved }: {
  capture: FmSeanceCapture;
  onCancel: () => void;
  /** `outlier`: a corrected price is too far from the group's readings to be shared. */
  onSaved: (seance: FmSeanceDetail, outlier: boolean) => void;
}) {
  const [typed, setTyped] = useState<Record<string, Typed>>(() => Object.fromEntries(
    capture.lines.map((line) => [line.id, { quantity: String(line.quantity), total: String(line.totalKamas) }]),
  ));
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const rows = capture.lines.map((line) => ({ line, typed: typed[line.id], values: correctionValues(typed[line.id].quantity, typed[line.id].total) }));
  const invalid = rows.some((row) => !row.values);
  const update = (id: string, changes: Partial<Typed>) => setTyped((current) => ({ ...current, [id]: { ...current[id], ...changes } }));

  const save = async () => {
    if (invalid) return;
    const changed = rows
      .filter(({ line, values }) => values!.quantity !== line.quantity || values!.totalKamas !== line.totalKamas)
      .map(({ line, values }) => ({ id: line.id, quantity: values!.quantity, totalKamas: values!.totalKamas }));
    if (changed.length === 0) {
      onCancel();
      return;
    }
    setSaving(true);
    setFailed(false);
    const result = await correctFmCapture(capture.id, changed);
    setSaving(false);
    if (result.status !== 'ok') {
      setFailed(true);
      return;
    }
    const ids = new Set(changed.map((line) => line.id));
    const saved = result.data.sessions.flatMap((session) => session.captures).find((entry) => entry.id === capture.id);
    onSaved(result.data, saved?.lines.some((line) => ids.has(line.id) && line.priceStatus === 'outlier') ?? false);
  };

  return (
    <div className="fm-correction">
      <table className="fm-items fm-correction-lines">
        <thead>
          <tr>
            <th scope="col">Objet</th>
            <th scope="col">Quantité</th>
            <th scope="col">Total</th>
            <th scope="col">Prix unitaire</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ line, typed: value, values }) => {
            const differs = !values || values.quantity !== line.originalQuantity || values.totalKamas !== line.originalTotalKamas;
            return (
              <tr key={line.id}>
                <th scope="row">
                  {line.itemName}
                  {differs && (
                    <span className="fm-correction-read">
                      lu : {quantityFormat.format(line.originalQuantity)} pour {formatKamas(line.originalTotalKamas)}{' '}
                      <button
                        type="button"
                        className="fm-link"
                        aria-label={`Rétablir la valeur lue de ${line.itemName}`}
                        disabled={saving}
                        onClick={() => update(line.id, { quantity: String(line.originalQuantity), total: String(line.originalTotalKamas) })}
                      >
                        Rétablir la valeur lue
                      </button>
                    </span>
                  )}
                </th>
                <td>
                  <input className="fm-number" inputMode="numeric" value={value.quantity} disabled={saving} aria-label={`Quantité de ${line.itemName}`} onChange={(event) => update(line.id, { quantity: event.target.value })} />
                </td>
                <td>
                  <input className="fm-number" inputMode="numeric" value={value.total} disabled={saving} aria-label={`Total de ${line.itemName}`} onChange={(event) => update(line.id, { total: event.target.value })} />
                </td>
                <td>{values ? <span className="fm-unit-price"><Kamas value={unitPriceKamas(values)} />/u</span> : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {invalid && <p className="fm-error" role="alert">Une quantité et un total d'au moins 1 sont attendus sur chaque ligne.</p>}
      {failed && <p className="fm-error" role="alert">La correction n’a pas pu être enregistrée. Réessaie.</p>}
      <div className="fm-import-actions">
        <button type="button" className="btn btn-secondary btn-small" onClick={onCancel} disabled={saving}>Annuler</button>
        <button type="button" className="btn btn-primary btn-small" onClick={() => void save()} disabled={invalid || saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}
