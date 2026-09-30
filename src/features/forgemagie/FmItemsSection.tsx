import { useRef, useState } from 'react';
import { fmItemDisplayName, type FmOwnedItem } from '../../domain/forgemagie';
import { formatKamas } from '../../domain/kamas';
import type { Item } from '../../domain/types';
import { createFmItem, deleteFmItem, renameFmItem } from '../../services/fm-api';
import { EquipmentPicker } from './EquipmentPicker';

// specs/027-fm-item-recap: the items in FM of a profile, with their total. On one's own profile: add,
// rename and delete (FR-001, FR-002, FR-004); on another member's, read only (US3).

const MAX_LABEL_LENGTH = 40;

export function FmItemIcon({ imageUrl }: { imageUrl: string | null }) {
  return imageUrl
    ? <img className="fm-item-icon" src={imageUrl} alt="" width={32} height={32} loading="lazy" />
    : <span className="fm-item-icon" aria-hidden="true" />;
}

function AddItem({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Item | undefined>(undefined);
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const close = () => {
    setOpen(false);
    setPicked(undefined);
    setLabel('');
    setFailed(false);
  };

  const save = async () => {
    if (!picked) return;
    setSaving(true);
    const result = await createFmItem({
      itemId: picked.id,
      itemName: picked.name,
      imageUrl: picked.imageUrl?.startsWith('https://api.dofusdb.fr/') ? picked.imageUrl : null,
      label: label.trim() || null,
    });
    setSaving(false);
    if (result.status !== 'ok') {
      setFailed(true);
      return;
    }
    close();
    onAdded();
  };

  if (!open) {
    return <button type="button" className="btn btn-secondary btn-small" onClick={() => setOpen(true)}>Ajouter un objet</button>;
  }
  return (
    <div className="fm-add-item">
      {picked ? (
        <>
          <p className="fm-picked"><FmItemIcon imageUrl={picked.imageUrl ?? null} /> <b>{picked.name}</b></p>
          <label className="fm-field">
            <span className="fm-field-label">Nom (facultatif)</span>
            <input
              value={label}
              maxLength={MAX_LABEL_LENGTH}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Par exemple « Rtograf PA »"
              aria-label="Nom de l'objet"
            />
            <span className="fm-note">Pour distinguer deux exemplaires du même équipement.</span>
          </label>
        </>
      ) : (
        <EquipmentPicker onPick={setPicked} />
      )}
      {failed && <p className="fm-error" role="alert">L'objet n'a pas pu être ajouté. Réessaie.</p>}
      <div className="fm-import-actions">
        <button type="button" className="btn btn-secondary" onClick={close} disabled={saving}>Annuler</button>
        {picked && <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving}>Ajouter</button>}
      </div>
    </div>
  );
}

function ItemActions({ item, onChanged }: { item: FmOwnedItem; onChanged: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [renaming, setRenaming] = useState(false);
  const [label, setLabel] = useState(item.label ?? '');
  const [failed, setFailed] = useState(false);

  const rename = async () => {
    const result = await renameFmItem(item.id, label.trim() || null);
    setFailed(result.status !== 'ok');
    if (result.status === 'ok') {
      setRenaming(false);
      onChanged();
    }
  };

  const remove = async () => {
    const result = await deleteFmItem(item.id);
    dialogRef.current?.close();
    if (result.status === 'ok') onChanged();
    else setFailed(true);
  };

  return (
    <span className="fm-item-actions">
      {renaming ? (
        <>
          <input value={label} maxLength={MAX_LABEL_LENGTH} onChange={(event) => setLabel(event.target.value)} aria-label={`Nouveau nom de ${fmItemDisplayName(item)}`} />
          <button type="button" className="btn btn-primary btn-small" onClick={() => void rename()}>Enregistrer</button>
          <button type="button" className="btn btn-secondary btn-small" onClick={() => setRenaming(false)}>Annuler</button>
        </>
      ) : (
        <>
          <button type="button" className="btn btn-secondary btn-small" onClick={() => setRenaming(true)}>Renommer</button>
          <button type="button" className="btn btn-secondary btn-small fm-delete" onClick={() => dialogRef.current?.showModal()}>Supprimer</button>
        </>
      )}
      {failed && <span className="fm-error" role="alert">Échec, réessaie.</span>}
      <dialog ref={dialogRef} className="outlier-confirm-dialog" aria-label={`Supprimer ${fmItemDisplayName(item)}`}>
        <p><b>Supprimer « {fmItemDisplayName(item)} » ?</b></p>
        <p>Ses sessions restent dans l'historique, mais ne seront plus rattachées à aucun objet.</p>
        <div className="outlier-confirm-dialog-actions">
          <button type="button" onClick={() => dialogRef.current?.close()}>Annuler</button>
          <button type="button" className="outlier-confirm-dialog-confirm" onClick={() => void remove()}>Supprimer l'objet</button>
        </div>
      </dialog>
    </span>
  );
}

export function FmItemsSection({ items, isMine, onOpenItem, onChanged }: {
  items: FmOwnedItem[];
  isMine: boolean;
  onOpenItem: (id: string) => void;
  onChanged: () => void;
}) {
  return (
    <section className="fm-items-section" aria-label="Objets en FM">
      <div className="fm-section-heading">
        <h3 className="fm-subtitle">Objets en FM</h3>
        {isMine && <AddItem onAdded={onChanged} />}
      </div>
      {items.length === 0 ? (
        <p className="fm-note">
          {isMine
            ? 'Ajoute l\'objet que tu forgemages, puis rattache-lui tes sessions depuis leur détail.'
            : 'Aucun objet en FM.'}
        </p>
      ) : (
        <ul className="fm-spend-list fm-owned-items">
          {items.map((item) => (
            <li key={item.id}>
              <button type="button" className="fm-link fm-owned-item" onClick={() => onOpenItem(item.id)}>
                <FmItemIcon imageUrl={item.imageUrl} />
                <span>
                  <b>{fmItemDisplayName(item)}</b>
                  {item.label && <span className="fm-note"> · {item.itemName}</span>}
                  <span className="fm-note"> · {item.sessionCount} {item.sessionCount > 1 ? 'sessions' : 'session'}</span>
                </span>
              </button>
              <span className="fm-amount">{formatKamas(item.totalKamas)}</span>
              {isMine && <ItemActions item={item} onChanged={onChanged} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
