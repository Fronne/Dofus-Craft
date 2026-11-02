import { useEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';

// 005-pinned-item-collections US3: "Sans collection" can never be renamed or deleted (it isn't a
// real collection — it's just every item without one), so it renders as a plain heading with no
// actions, unlike a named group.
export function CollectionHeading({
  name,
  onRename,
  onDelete,
}: {
  name?: string;
  onRename: (newName: string) => void;
  onDelete: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  // Deleting asks once more, in place: a list is not brought back with one click.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [draft, setDraft] = useState(name ?? '');
  // After an edit is validated or canceled, the focus goes back to the button that opened it.
  const renameButton = useRef<HTMLButtonElement>(null);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const focusBack = useRef<'rename' | 'delete' | undefined>(undefined);
  useEffect(() => {
    if (renaming || confirmingDelete || !focusBack.current) return;
    (focusBack.current === 'rename' ? renameButton : deleteButton).current?.focus();
    focusBack.current = undefined;
  }, [renaming, confirmingDelete]);

  if (!name) {
    return <h2 className="pinned-collection-title">Sans liste</h2>;
  }

  if (confirmingDelete) {
    const cancel = () => {
      focusBack.current = 'delete';
      setConfirmingDelete(false);
    };
    return (
      <div
        className="pinned-collection-title pinned-collection-confirm"
        role="group"
        aria-label={`Supprimer la liste ${name}`}
        onKeyDown={(event) => {
          if (event.key === 'Escape') cancel();
        }}
      >
        <span>Supprimer la liste « {name} » ? Ses objets restent suivis.</span>
        <button type="button" className="btn btn-danger btn-small" onClick={onDelete}>Supprimer</button>
        <button type="button" className="btn btn-secondary btn-small" autoFocus onClick={cancel}>Annuler</button>
      </div>
    );
  }

  if (renaming) {
    const cancel = () => {
      focusBack.current = 'rename';
      setRenaming(false);
      setDraft(name);
    };
    return (
      <form
        className="pinned-collection-title pinned-collection-title-editing"
        onKeyDown={(event) => {
          if (event.key === 'Escape') cancel();
        }}
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = draft.trim();
          if (trimmed) onRename(trimmed);
          focusBack.current = 'rename';
          setRenaming(false);
        }}
      >
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-label={`Renommer la liste ${name}`}
          autoFocus
        />
        <button type="submit" className="icon-button" aria-label="Valider le renommage">
          <Icon name="check" size={14} />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="Annuler le renommage"
          onClick={cancel}
        >
          <Icon name="close" size={14} />
        </button>
      </form>
    );
  }

  return (
    <h2 className="pinned-collection-title">
      {name}
      <button
        ref={renameButton}
        type="button"
        className="icon-button"
        aria-label={`Renommer la liste ${name}`}
        onClick={() => {
          setDraft(name);
          setRenaming(true);
        }}
      >
        <Icon name="edit" size={14} />
      </button>
      <button ref={deleteButton} type="button" className="icon-button" aria-label={`Supprimer la liste ${name}`} onClick={() => setConfirmingDelete(true)}>
        <Icon name="close" size={14} />
      </button>
    </h2>
  );
}

// 005-pinned-item-collections: the single, page-level way to create a collection — items are
// assigned to it afterward from their own card, never at creation time (feedback from the earlier
// design where each card offered its own inline "create" option: too repetitive across many cards).
export function NewCollectionButton({ onCreate }: { onCreate: (name: string) => void }) {
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState('');
  const openButton = useRef<HTMLButtonElement>(null);
  const wasCreating = useRef(false);
  useEffect(() => {
    if (wasCreating.current && !creating) openButton.current?.focus();
    wasCreating.current = creating;
  }, [creating]);

  if (creating) {
    const close = () => {
      setCreating(false);
      setDraft('');
    };
    return (
      <form
        className="new-collection-form"
        onKeyDown={(event) => {
          if (event.key === 'Escape') close();
        }}
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = draft.trim();
          if (trimmed) onCreate(trimmed);
          close();
        }}
      >
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Nom de la liste"
          aria-label="Nom de la nouvelle liste"
          autoFocus
        />
        <button type="submit" className="icon-button" aria-label="Créer la liste">
          <Icon name="check" size={16} />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="Annuler la création de liste"
          onClick={close}
        >
          <Icon name="close" size={16} />
        </button>
      </form>
    );
  }

  return (
    <button ref={openButton} type="button" className="btn btn-secondary" onClick={() => setCreating(true)}>
      + Nouvelle liste
    </button>
  );
}
