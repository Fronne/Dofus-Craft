import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { fmItemDisplayName, matchesItemQuery, type FmAttachTarget, type FmOwnedItem } from '../../domain/forgemagie';
import type { Item } from '../../domain/types';
import { FmItemIcon } from './FmItemIcon';
import { MIN_QUERY_LENGTH, useEquipmentSearch } from './useEquipmentSearch';

// specs/031-fm-session-captures (US2) then specs/049-fm-seances (US2): choose the item of a séance by
// typing a name — the player's own items in FM first, then the catalogue's equipment, which creates a
// new item.

/** What was picked, with enough to show it before it is sent. */
export type PickedItem = { target: FmAttachTarget; name: string; imageUrl: string | null };

function pickedEquipment(item: Item): PickedItem {
  // Only the catalogue's own pictures are kept with the item.
  const imageUrl = item.imageUrl?.startsWith('https://api.dofusdb.fr/') ? item.imageUrl : null;
  return { target: { item: { itemId: item.id, itemName: item.name, imageUrl } }, name: item.name, imageUrl: item.imageUrl ?? null };
}

export function SeanceItemSearch({ label, myItems, disabled = false, onPick }: {
  label: string;
  myItems: FmOwnedItem[];
  disabled?: boolean;
  onPick: (picked: PickedItem) => void;
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
          placeholder={`${label}…`}
          aria-label={label}
        />
      </div>
      {!tooShort && (
        <div className="fm-item-search-results">
          {mine.length > 0 && (
            <>
              <p className="fm-item-search-group">Mes objets en FM</p>
              <ul className="fm-picker-results">
                {mine.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="fm-picker-result"
                      disabled={disabled}
                      onClick={() => onPick({ target: { fmItemId: item.id }, name: fmItemDisplayName(item), imageUrl: item.imageUrl })}
                    >
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
                    <button type="button" className="fm-picker-result" disabled={disabled} onClick={() => onPick(pickedEquipment(item))}>
                      <FmItemIcon imageUrl={item.imageUrl ?? null} />
                      <span>{item.name}</span>
                      {item.level !== undefined && <span className="fm-note">Niv. {item.level}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {nothing && <p className="fm-note">Aucun objet ne correspond.</p>}
        </div>
      )}
    </div>
  );
}
