import { useEffect, useState } from 'react';
import { Icon } from '../../components/Icon';
import { searchItems } from '../../data/catalogue-repository';
import type { Item } from '../../domain/types';

// specs/027-fm-item-recap (FR-001): choose the equipment of a new item in FM from the catalogue — the
// same search as the Recherche page, equipment only.

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;
const MAX_RESULTS = 10;

type State = { status: 'idle' | 'searching' | 'unavailable' } | { status: 'ready'; items: Item[] };

export function EquipmentPicker({ onPick }: { onPick: (item: Item) => void }) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<State>({ status: 'idle' });

  useEffect(() => {
    if (query.trim().length < MIN_QUERY_LENGTH) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setState({ status: 'searching' });
      searchItems(query, '', 0, 40)
        .then((result) => {
          if (!cancelled) setState({ status: 'ready', items: result.data.filter((item) => item.kind === 'Equipment').slice(0, MAX_RESULTS) });
        })
        .catch(() => {
          if (!cancelled) setState({ status: 'unavailable' });
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const tooShort = query.trim().length < MIN_QUERY_LENGTH;

  return (
    <div className="fm-picker">
      <div className="search-input-wrap">
        <Icon name="search" size={18} className="search-input-icon" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher un équipement..."
          aria-label="Rechercher un équipement"
          autoFocus
        />
      </div>
      {!tooShort && state.status === 'searching' && <p className="fm-note" role="status">Recherche…</p>}
      {!tooShort && state.status === 'unavailable' && <p className="fm-error" role="alert">Le catalogue est indisponible pour le moment.</p>}
      {!tooShort && state.status === 'ready' && state.items.length === 0 && <p className="fm-note">Aucun équipement ne correspond.</p>}
      {!tooShort && state.status === 'ready' && state.items.length > 0 && (
        <ul className="fm-picker-results">
          {state.items.map((item) => (
            <li key={item.id}>
              <button type="button" className="fm-picker-result" onClick={() => onPick(item)}>
                {item.imageUrl ? <img src={item.imageUrl} alt="" width={32} height={32} loading="lazy" /> : <span className="fm-item-icon" aria-hidden="true" />}
                <span>{item.name}</span>
                {item.level !== undefined && <span className="fm-note">Niv. {item.level}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
