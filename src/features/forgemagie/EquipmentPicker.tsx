import { useState } from 'react';
import { Icon } from '../../components/Icon';
import type { Item } from '../../domain/types';
import { useEquipmentSearch } from './useEquipmentSearch';

// specs/027-fm-item-recap (FR-001): choose the equipment of a new item in FM from the catalogue — the
// same search as the Recherche page, equipment only.

export function EquipmentResult({ item, onPick }: { item: Item; onPick: (item: Item) => void }) {
  return (
    <button type="button" className="fm-picker-result" onClick={() => onPick(item)}>
      {item.imageUrl ? <img src={item.imageUrl} alt="" width={32} height={32} loading="lazy" /> : <span className="fm-item-icon" aria-hidden="true" />}
      <span>{item.name}</span>
      {item.level !== undefined && <span className="fm-note">Niv. {item.level}</span>}
    </button>
  );
}

export function EquipmentPicker({ onPick }: { onPick: (item: Item) => void }) {
  const [query, setQuery] = useState('');
  const state = useEquipmentSearch(query);

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
      {state.status === 'searching' && <p className="fm-note" role="status">Recherche…</p>}
      {state.status === 'unavailable' && <p className="fm-error" role="alert">Le catalogue est indisponible pour le moment.</p>}
      {state.status === 'ready' && state.items.length === 0 && <p className="fm-note">Aucun équipement ne correspond.</p>}
      {state.status === 'ready' && state.items.length > 0 && (
        <ul className="fm-picker-results">
          {state.items.map((item) => <li key={item.id}><EquipmentResult item={item} onPick={onPick} /></li>)}
        </ul>
      )}
    </div>
  );
}
