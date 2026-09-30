import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { fmItemDisplayName, matchesItemQuery, type FmAttachTarget, type FmOwnedItem } from '../../domain/forgemagie';
import { EquipmentResult } from './EquipmentPicker';
import { FmItemIcon } from './FmItemsSection';
import { MIN_QUERY_LENGTH, useEquipmentSearch } from './useEquipmentSearch';

// specs/031-fm-session-captures (US2, FR-008 to FR-011): attach the session by typing a name — the
// player's own items in FM first, then the catalogue's equipment, which creates a new item.

export function SessionItemSearch({ myItems, disabled, onPick }: {
  myItems: FmOwnedItem[];
  disabled: boolean;
  onPick: (target: FmAttachTarget) => void;
}) {
  const [query, setQuery] = useState('');
  const catalogue = useEquipmentSearch(query);
  const tooShort = query.trim().length < MIN_QUERY_LENGTH;
  const mine = tooShort ? [] : myItems.filter((item) => matchesItemQuery(item, query));
  const nothing = !tooShort && mine.length === 0 && catalogue.status === 'ready' && catalogue.items.length === 0;

  return (
    <div className="fm-picker fm-item-search">
      <div className="search-input-wrap">
        <Icon name="search" size={18} className="search-input-icon" />
        <input
          type="search"
          value={query}
          disabled={disabled}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rattacher à un objet…"
          aria-label="Rattacher à un objet"
        />
      </div>
      {mine.length > 0 && (
        <>
          <p className="fm-item-search-group">Mes objets en FM</p>
          <ul className="fm-picker-results">
            {mine.map((item) => (
              <li key={item.id}>
                <button type="button" className="fm-picker-result" disabled={disabled} onClick={() => onPick({ fmItemId: item.id })}>
                  <FmItemIcon imageUrl={item.imageUrl} />
                  <span>{fmItemDisplayName(item)}</span>
                  {item.label && <span className="fm-note">{item.itemName}</span>}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {catalogue.status === 'searching' && <p className="fm-note" role="status">Recherche…</p>}
      {catalogue.status === 'unavailable' && <p className="fm-error" role="alert">Le catalogue est indisponible pour le moment.</p>}
      {catalogue.status === 'ready' && catalogue.items.length > 0 && (
        <>
          <p className="fm-item-search-group">Catalogue <span className="fm-note">(crée un nouvel objet en FM)</span></p>
          <ul className="fm-picker-results">
            {catalogue.items.map((item) => (
              <li key={item.id}>
                <EquipmentResult
                  item={item}
                  onPick={(picked) => onPick({
                    item: {
                      itemId: picked.id,
                      itemName: picked.name,
                      imageUrl: picked.imageUrl?.startsWith('https://api.dofusdb.fr/') ? picked.imageUrl : null,
                    },
                  })}
                />
              </li>
            ))}
          </ul>
        </>
      )}
      {nothing && <p className="fm-note">Aucun objet ne correspond.</p>}
    </div>
  );
}
