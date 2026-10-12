import { useEffect, useState } from 'react';
import type { FmMe, FmOwnedItem, FmSeanceDetail } from '../../domain/forgemagie';
import { getFmPlayer, removeFmSeanceItem, renameFmItem, setFmSeanceItem } from '../../services/fm-api';
import { FmItemIcon } from './FmItemIcon';
import { SeanceItemSearch } from './SeanceItemSearch';

// specs/049-fm-seances (US2): the item forgemaged in a séance — choose it, change it, give it a name of
// one's own, or remove it.

const MAX_LABEL_LENGTH = 40;

export function SeanceItem({ seance, me, onChanged, onRenamed }: {
  seance: FmSeanceDetail;
  me: FmMe;
  onChanged: (seance: FmSeanceDetail) => void;
  /** The item's name changed: the séance is to be reread. */
  onRenamed: () => void;
}) {
  const item = seance.fmItem;
  const [choosing, setChoosing] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [label, setLabel] = useState('');
  const [myItems, setMyItems] = useState<FmOwnedItem[]>([]);
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const picking = item === null || choosing;

  useEffect(() => {
    if (!picking) return;
    let cancelled = false;
    void getFmPlayer(me.discordUserId).then((result) => {
      if (!cancelled && result.status === 'ok') setMyItems(result.data.fmItems);
    });
    return () => {
      cancelled = true;
    };
  }, [picking, me.discordUserId]);

  const act = async (action: () => ReturnType<typeof removeFmSeanceItem>) => {
    setBusy(true);
    setError(undefined);
    const result = await action();
    setBusy(false);
    if (result.status === 'ok') {
      setChoosing(false);
      onChanged(result.data);
    } else {
      setError('L’opération a échoué. Réessaie.');
    }
  };

  const rename = async () => {
    if (!item) return;
    setBusy(true);
    setError(undefined);
    const result = await renameFmItem(item.id, label.trim() || null);
    setBusy(false);
    if (result.status === 'ok') {
      setRenaming(false);
      onRenamed();
    } else {
      setError('L’objet n’a pas pu être renommé. Réessaie.');
    }
  };

  return (
    <div className="fm-session-item">
      {item && (
        <>
          <span className="fm-item-chip">
            <FmItemIcon imageUrl={item.imageUrl} />
            <span className="fm-item-chip-text">
              <span className="fm-item-chip-label">Objet en FM</span>
              <b>{item.name}</b>
              {item.label && <span className="fm-note">{item.itemName}</span>}
            </span>
          </span>
          {renaming ? (
            <span className="fm-item-actions">
              <input
                value={label}
                maxLength={MAX_LABEL_LENGTH}
                onChange={(event) => setLabel(event.target.value)}
                aria-label={`Nouveau nom de ${item.name}`}
                autoFocus
              />
              <button type="button" className="btn btn-primary btn-small" disabled={busy} onClick={() => void rename()}>Enregistrer</button>
              <button type="button" className="btn btn-secondary btn-small" disabled={busy} onClick={() => setRenaming(false)}>Annuler</button>
            </span>
          ) : (
            <span className="fm-item-actions">
              <button type="button" className="btn btn-secondary btn-small" aria-expanded={choosing} disabled={busy} onClick={() => setChoosing((value) => !value)}>
                {choosing ? 'Annuler' : 'Changer'}
              </button>
              {!choosing && (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    disabled={busy}
                    onClick={() => {
                      setLabel(item.label ?? '');
                      setRenaming(true);
                    }}
                  >
                    Renommer
                  </button>
                  <button type="button" className="btn btn-secondary btn-small" disabled={busy} onClick={() => void act(() => removeFmSeanceItem(seance.id))}>
                    Retirer
                  </button>
                </>
              )}
            </span>
          )}
        </>
      )}
      {picking && !renaming && (
        <SeanceItemSearch
          label={item ? 'Choisir un autre objet' : 'Choisir l’objet de la séance'}
          myItems={myItems}
          disabled={busy}
          onPick={(picked) => void act(() => setFmSeanceItem(seance.id, picked.target))}
        />
      )}
      {error && <p className="fm-error" role="alert">{error}</p>}
    </div>
  );
}
