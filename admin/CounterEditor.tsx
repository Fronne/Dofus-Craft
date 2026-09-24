import { useState } from 'react';
import { breedName, portraitUrl } from '../src/domain/breeds';
import { formatCount, validateCounterInput, type PlayerCounter } from '../src/domain/player-counter';
import { adminApi } from './admin-api';
import { failureMessage, parseCount } from './messages';

// specs/014-admin-counters, US1 and US4: one card per counter — change its number and "at least",
// or delete it after a confirmation naming the player and what is counted.
export function CounterEditor({
  counter,
  onChanged,
}: {
  counter: PlayerCounter;
  onChanged: (message: string) => void;
}) {
  const [countText, setCountText] = useState(String(counter.count));
  const [atLeast, setAtLeast] = useState(counter.atLeast);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | undefined>(undefined);
  const countId = `count-${counter.id}`;

  async function save() {
    const validation = validateCounterInput({ count: parseCount(countText), atLeast }, 'update');
    if (!validation.ok) {
      setMessage({ text: validation.error, error: true });
      return;
    }
    setBusy(true);
    const result = await adminApi.update(counter.id, validation.value);
    setBusy(false);
    if (result.status === 'ok') {
      setMessage({ text: 'Enregistré.', error: false });
      onChanged('');
    } else {
      setMessage({ text: failureMessage(result), error: true });
    }
  }

  async function remove() {
    if (!window.confirm(`Supprimer le compteur de ${counter.player} (${counter.unitMany}) ?`)) return;
    setBusy(true);
    const result = await adminApi.remove(counter.id);
    setBusy(false);
    if (result.status === 'ok') onChanged('Compteur supprimé.');
    else setMessage({ text: failureMessage(result), error: true });
  }

  return (
    <article className="admin-counter" aria-label={`Compteur de ${counter.player}`}>
      <div className="admin-counter-who">
        <img src={portraitUrl(counter.breedId, counter.sex)} alt="" width={48} height={48} />
        <div>
          <p className="admin-counter-player">{counter.player}</p>
          <p className="admin-counter-meta">{breedName(counter.breedId)} · {counter.sex === 'f' ? 'femme' : 'homme'}</p>
        </div>
        <span className="admin-counter-current" title="Valeur actuelle">{formatCount(counter)}</span>
      </div>
      <p className="admin-counter-target">
        <img src={counter.target.icon} alt="" width={24} height={24} />
        <span>{counter.unitMany} · {counter.target.name}</span>
      </p>
      <div className="admin-counter-edit">
        <label htmlFor={countId}>Chiffre</label>
        <input id={countId} inputMode="numeric" value={countText} onChange={(event) => setCountText(event.target.value)} />
        <label className="admin-checkbox">
          <input type="checkbox" checked={atLeast} onChange={(event) => setAtLeast(event.target.checked)} />
          <span>Au moins (affiche un +)</span>
        </label>
      </div>
      <div className="admin-counter-actions">
        <button type="button" className="btn btn-primary btn-small" disabled={busy} onClick={() => void save()}>Enregistrer</button>
        <button type="button" className="btn btn-secondary btn-small admin-danger" disabled={busy} onClick={() => void remove()}>Supprimer</button>
      </div>
      {message && <p className={message.error ? 'admin-message admin-message--error' : 'admin-message'} role="status">{message.text}</p>}
    </article>
  );
}
