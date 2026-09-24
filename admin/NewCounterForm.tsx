import { useState, type FormEvent } from 'react';
import { BREEDS, portraitUrl, type Sex } from '../src/domain/breeds';
import { validateCounterInput, type CounterTarget } from '../src/domain/player-counter';
import { searchDofusDbItemsByName } from '../src/services/dofusdb-api';
import { adminApi } from './admin-api';
import { failureMessage, parseCount } from './messages';

const FIELD_LABELS: Record<string, string> = {
  player: 'Pseudo',
  breedId: 'Classe',
  sex: 'Sexe',
  count: 'Chiffre de départ',
  atLeast: 'Au moins',
  unitOne: 'Libellé au singulier',
  unitMany: 'Libellé au pluriel',
  target: 'Objet visé',
};

// specs/014-admin-counters, US3: everything a new bubble needs — the player, the class and sex of
// the character (official portrait preview), what is counted, the targeted item picked from the
// game catalogue, and the starting number.
export function NewCounterForm({ onCreated }: { onCreated: (message: string) => void }) {
  const [player, setPlayer] = useState('');
  const [breedId, setBreedId] = useState('');
  const [sex, setSex] = useState<Sex>('m');
  const [unitOne, setUnitOne] = useState('');
  const [unitMany, setUnitMany] = useState('');
  const [countText, setCountText] = useState('0');
  const [atLeast, setAtLeast] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CounterTarget[]>([]);
  const [target, setTarget] = useState<CounterTarget | undefined>(undefined);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | undefined>(undefined);

  async function search() {
    setSearching(true);
    setMessage(undefined);
    try {
      const found = await searchDofusDbItemsByName(query);
      setResults(found);
      if (found.length === 0) setMessage({ text: 'Aucun objet trouvé.', error: true });
    } catch {
      setResults([]);
      setMessage({ text: 'Le catalogue du jeu est injoignable pour le moment.', error: true });
    }
    setSearching(false);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const validation = validateCounterInput({
      player,
      breedId: breedId ? Number(breedId) : undefined,
      sex,
      count: parseCount(countText),
      atLeast,
      unitOne,
      unitMany,
      target,
    }, 'create');
    if (!validation.ok) {
      setMessage({ text: `${FIELD_LABELS[validation.field] ?? validation.field} : ${validation.error}`, error: true });
      return;
    }
    setBusy(true);
    const result = await adminApi.create(validation.value);
    setBusy(false);
    if (result.status !== 'ok') {
      setMessage({ text: failureMessage(result), error: true });
      return;
    }
    setPlayer('');
    setBreedId('');
    setUnitOne('');
    setUnitMany('');
    setCountText('0');
    setAtLeast(false);
    setQuery('');
    setResults([]);
    setTarget(undefined);
    setMessage(undefined);
    onCreated('Compteur ajouté.');
  }

  return (
    <form className="admin-new-counter" onSubmit={(event) => void submit(event)} aria-label="Nouveau compteur">
      <h3>Nouveau compteur</h3>
      <div className="admin-form-grid">
        <label>
          <span>Pseudo</span>
          <input value={player} onChange={(event) => setPlayer(event.target.value)} maxLength={40} />
        </label>
        <label>
          <span>Classe</span>
          <select value={breedId} onChange={(event) => setBreedId(event.target.value)}>
            <option value="">Choisir…</option>
            {BREEDS.map((breed) => <option key={breed.id} value={breed.id}>{breed.name}</option>)}
          </select>
        </label>
        <fieldset className="admin-sex">
          <legend>Sexe</legend>
          <label><input type="radio" name="sex" checked={sex === 'm'} onChange={() => setSex('m')} /> Homme</label>
          <label><input type="radio" name="sex" checked={sex === 'f'} onChange={() => setSex('f')} /> Femme</label>
        </fieldset>
        <div className="admin-portrait-preview">
          {breedId
            ? <img src={portraitUrl(Number(breedId), sex)} alt="Aperçu du portrait" width={56} height={56} />
            : <span>Aperçu du portrait</span>}
        </div>
        <label>
          <span>Libellé au singulier</span>
          <input value={unitOne} onChange={(event) => setUnitOne(event.target.value)} maxLength={40} placeholder="tentative de FM" />
        </label>
        <label>
          <span>Libellé au pluriel</span>
          <input value={unitMany} onChange={(event) => setUnitMany(event.target.value)} maxLength={40} placeholder="tentatives de FM" />
        </label>
        <label>
          <span>Chiffre de départ</span>
          <input inputMode="numeric" value={countText} onChange={(event) => setCountText(event.target.value)} />
        </label>
        <label className="admin-checkbox">
          <input type="checkbox" checked={atLeast} onChange={(event) => setAtLeast(event.target.checked)} />
          <span>Au moins (affiche un +)</span>
        </label>
      </div>

      <div className="admin-target">
        <label>
          <span>Objet visé</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void search();
              }
            }}
            placeholder="Nom de l'objet ou de la ressource"
          />
        </label>
        <button type="button" className="btn btn-secondary btn-small" disabled={searching || !query.trim()} onClick={() => void search()}>
          Rechercher
        </button>
      </div>
      {target && (
        <p className="admin-target-chosen">
          <img src={target.icon} alt="" width={28} height={28} />
          <span>{target.name}</span>
        </p>
      )}
      {results.length > 0 && (
        <ul className="admin-target-results">
          {results.map((item) => (
            <li key={item.itemId}>
              <button
                type="button"
                className={target?.itemId === item.itemId ? 'selected' : ''}
                aria-pressed={target?.itemId === item.itemId}
                onClick={() => setTarget(item)}
              >
                <img src={item.icon} alt="" width={28} height={28} />
                <span>{item.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="admin-counter-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>Ajouter</button>
      </div>
      {message && <p className={message.error ? 'admin-message admin-message--error' : 'admin-message'} role="status">{message.text}</p>}
    </form>
  );
}
