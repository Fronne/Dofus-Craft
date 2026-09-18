import { useEffect, useState } from 'react';
import type { Item } from '../../domain/types';
import { loadPinnedItems, savePinnedItems, type PinnedItem } from '../../persistence/pinned-items';
import { loadCollectionNames, saveCollectionNames } from '../../persistence/pinned-collections';

function sameCollectionName(a: string, b: string): boolean {
  return a.toLocaleLowerCase('fr') === b.toLocaleLowerCase('fr');
}

// Resolves a player-typed name against the collections that currently exist: a case-insensitive
// match reuses that collection's existing casing (set the first time it was created) rather than
// the newly typed one, so a collection's displayed name never changes just because someone typed
// it differently later (research.md, "Unicité de nom insensible à la casse").
function resolveCollectionName(existingNames: string[], name: string | undefined): string | undefined {
  const trimmed = name?.trim();
  if (!trimmed) return undefined;
  const existing = existingNames.find((candidate) => sameCollectionName(candidate, trimmed));
  return existing ?? trimmed;
}

function withCollectionName(item: PinnedItem['item'], collectionName: string | undefined): PinnedItem {
  return collectionName ? { item, collectionName } : { item };
}

function withoutName(names: string[], name: string): string[] {
  return names.filter((candidate) => !sameCollectionName(candidate, name));
}

function withName(names: string[], name: string): string[] {
  return names.some((candidate) => sameCollectionName(candidate, name)) ? names : [...names, name];
}

export function usePinnedItems() {
  const [pinnedItems, setPinnedItems] = useState<PinnedItem[]>(() => loadPinnedItems());
  // 005-pinned-item-collections: a collection a player explicitly created via the single "+
  // Nouvelle collection" action, independent of `pinnedItems` — this is what lets a collection
  // exist with zero items until one is assigned to it from a card's own picker.
  const [collectionNames, setCollectionNames] = useState<string[]>(() => loadCollectionNames());

  useEffect(() => {
    savePinnedItems(pinnedItems);
  }, [pinnedItems]);

  useEffect(() => {
    saveCollectionNames(collectionNames);
  }, [collectionNames]);

  const isPinned = (id: string) => pinnedItems.some((entry) => entry.item.id === id);
  const pin = (item: Item) => {
    setPinnedItems((current) => {
      if (current.some((entry) => entry.item.id === item.id)) return current;
      return [...current, { item }];
    });
  };
  const unpin = (id: string) => {
    setPinnedItems((current) => current.filter((entry) => entry.item.id !== id));
  };

  const listCollectionNames = () => [...collectionNames].sort((a, b) => a.localeCompare(b, 'fr'));

  // FR-001: the single explicit creation action — registers the name so it can be offered and
  // shown as its own (possibly empty) group, without assigning any item to it.
  const createCollection = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCollectionNames((current) => withName(current, resolveCollectionName(current, trimmed) as string));
  };

  // FR-002/FR-003/FR-008: assigns at most one collection per item, replacing any previous one.
  const assignCollection = (itemId: string, name: string | undefined) => {
    const resolved = resolveCollectionName(collectionNames, name);
    setPinnedItems((current) =>
      current.map((entry) => (entry.item.id === itemId ? withCollectionName(entry.item, resolved) : entry)),
    );
    if (resolved) setCollectionNames((current) => withName(current, resolved));
  };

  // FR-006: reassigns every item currently in `oldName` to `newName`, merging into an existing
  // collection when `newName` matches one (case-insensitively) other than `oldName` itself. Also
  // renames the registered collection itself, so an empty collection can be renamed too.
  const renameCollection = (oldName: string, newName: string | undefined) => {
    const otherNames = withoutName(collectionNames, oldName);
    const resolved = resolveCollectionName(otherNames, newName);
    setPinnedItems((current) =>
      current.map((entry) =>
        entry.collectionName && sameCollectionName(entry.collectionName, oldName)
          ? withCollectionName(entry.item, resolved)
          : entry,
      ),
    );
    setCollectionNames((current) => {
      const withoutOld = withoutName(current, oldName);
      return resolved ? withName(withoutOld, resolved) : withoutOld;
    });
  };

  // FR-007: moves every item of this collection back to "Sans collection" and un-registers it —
  // never unpins the items themselves, unlike `unpin` above.
  const deleteCollection = (name: string) => renameCollection(name, undefined);

  return {
    pinnedItems,
    isPinned,
    pin,
    unpin,
    listCollectionNames,
    createCollection,
    assignCollection,
    renameCollection,
    deleteCollection,
  };
}
