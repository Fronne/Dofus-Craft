import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePinnedItems } from './usePinnedItems';
import { EmptyState } from '../../components/EmptyState';
import { ROUTES } from '../../app/router';
import { useActiveServer } from '../../app/ServerContext';
import type { PriceMode } from '../../domain/price-modes';
import type { PinnedItem } from '../../persistence/pinned-items';
import { usePinnedSummaries } from './usePinnedSummaries';
import { CollectionHeading, NewCollectionButton } from './PinnedCollectionControls';
import { PinnedCard } from './PinnedCard';

// 005-pinned-item-collections FR-004/FR-011: one group per registered collection name (from
// `listCollectionNames()`, which may include collections with zero items — created via the
// page-level "+ Nouvelle collection" action, populated afterward from a card's own picker), plus
// "Sans collection" last for any item with none. Sorted alphabetically; `collectionNames` is
// already alphabetical (see `usePinnedItems.listCollectionNames`).
function groupByCollection(
  pinnedItems: PinnedItem[],
  collectionNames: string[],
): { name?: string; items: PinnedItem[] }[] {
  const itemsByName = new Map<string, PinnedItem[]>();
  const ungrouped: PinnedItem[] = [];
  for (const entry of pinnedItems) {
    if (!entry.collectionName) {
      ungrouped.push(entry);
      continue;
    }
    itemsByName.set(entry.collectionName, [...(itemsByName.get(entry.collectionName) ?? []), entry]);
  }
  const namedGroups = collectionNames.map((name) => ({ name, items: itemsByName.get(name) ?? [] }));
  return ungrouped.length > 0 ? [...namedGroups, { name: undefined, items: ungrouped }] : namedGroups;
}

export function EpinglesPage({ priceMode }: { priceMode: PriceMode }) {
  const { pinnedItems, pin, unpin, listCollectionNames, createCollection, assignCollection, renameCollection, deleteCollection } = usePinnedItems();
  const navigate = useNavigate();
  const { serverId } = useActiveServer();
  // The item just removed from the list, kept for a while so « Annuler » can put it back.
  const [removed, setRemoved] = useState<PinnedItem>();
  const collectionNames = listCollectionNames();
  // 005-pinned-item-collections: drag a card onto another collection's zone (including "Sans
  // collection") to move it there — the only way to change a card's collection on this page.
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverGroupKey, setDragOverGroupKey] = useState<string | null>(null);
  const pinnedItemIds = pinnedItems.map((entry) => entry.item.id).join(',');
  const { summaries, loadingSummaries, summariesError, retry } = usePinnedSummaries(serverId, pinnedItemIds, priceMode);

  return (
    <>
      <header className="page-header">
        <h1>Suivis</h1>
        <p>Retrouvez rapidement vos objets suivis, sans refaire de recherche.</p>
      </header>
      {pinnedItems.length > 0 && (
        <div className="pinned-collections-toolbar">
          <NewCollectionButton onCreate={createCollection} />
        </div>
      )}
      {summariesError && pinnedItems.length > 0 && (
        <div className="inline-retry" role="alert">
          <p className="warning">Impossible de calculer les prix de vos objets suivis.</p>
          <button type="button" className="btn btn-secondary btn-small" onClick={retry}>Réessayer</button>
        </div>
      )}
      {removed && (
        <div className="inline-retry pinned-removed" role="status">
          <p>« {removed.item.name} » n'est plus suivi.</p>
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() => {
              pin(removed.item);
              if (removed.collectionName) assignCollection(removed.item.id, removed.collectionName);
              setRemoved(undefined);
            }}
          >
            Annuler
          </button>
        </div>
      )}
      {pinnedItems.length === 0 ? (
        <EmptyState
          icon="bookmark"
          title="Aucun objet suivi"
          description="Suivez un objet depuis la recherche pour le retrouver ici, quel que soit le serveur actif."
        >
          <Link to={ROUTES.search} className="btn btn-primary">Rechercher un objet</Link>
        </EmptyState>
      ) : (
        groupByCollection(pinnedItems, collectionNames).map((group) => {
          const groupKey = group.name ?? '__ungrouped__';
          return (
          <section className="pinned-collection" key={groupKey}>
            <CollectionHeading
              name={group.name}
              onRename={(newName) => renameCollection(group.name as string, newName)}
              onDelete={() => deleteCollection(group.name as string)}
            />
            <div
              className={`pinned-collection-body${dragOverGroupKey === groupKey ? ' pinned-collection-body-drag-over' : ''}`}
              onDragOver={(event) => {
                if (!draggedItemId) return;
                event.preventDefault();
                setDragOverGroupKey(groupKey);
              }}
              onDragLeave={() => setDragOverGroupKey((current) => (current === groupKey ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                const itemId = event.dataTransfer.getData('text/plain');
                if (itemId) assignCollection(itemId, group.name);
                setDragOverGroupKey(null);
                setDraggedItemId(null);
              }}
            >
            {group.items.length === 0 ? (
              <p className="pinned-collection-empty muted">Aucun objet dans cette liste pour le moment.</p>
            ) : (
            <div className="pinned-grid" aria-label={`Objets suivis — ${group.name ?? 'Sans liste'}`}>
              {group.items.map((entry) => (
                <PinnedCard
                  key={entry.item.id}
                  entry={entry}
                  summary={summaries[entry.item.id]}
                  loadingSummaries={loadingSummaries}
                  collectionNames={collectionNames}
                  groupName={group.name}
                  dragging={draggedItemId === entry.item.id}
                  onDragStart={(event) => {
                    setDraggedItemId(entry.item.id);
                    event.dataTransfer.setData('text/plain', entry.item.id);
                    event.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnd={() => {
                    setDraggedItemId(null);
                    setDragOverGroupKey(null);
                  }}
                  onOpen={() => navigate(`${ROUTES.search}?item=${entry.item.id}`)}
                  onRemove={() => {
                    setRemoved(entry);
                    unpin(entry.item.id);
                  }}
                  onAssign={(collectionName) => assignCollection(entry.item.id, collectionName)}
                />
              ))}
            </div>
            )}
            </div>
          </section>
          );
        })
      )}
    </>
  );
}