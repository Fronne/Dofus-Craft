import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePinnedItems } from './usePinnedItems';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { ROUTES } from '../../app/router';
import { useActiveServer } from '../../app/ServerContext';
import { getItemDetail } from '../../data/catalogue-repository';
import { resourcePricesFor } from '../../persistence/resource-prices-for-mode';
import type { PriceMode } from '../../domain/price-modes';
import { pinnedItemPrices } from '../../persistence/indexeddb-pinned-item-price-repository';
import { compare } from '../../domain/craft-comparison';
import { lookupCommunityMedian } from '../comparison/useCommunityPrice';
import { formatKamas } from '../../domain/kamas';
import type { PinnedItem } from '../../persistence/pinned-items';

type PinnedPriceSummary = {
  craftCostKamas?: number;
  marketPriceKamas?: number;
  recommendation?: 'craft' | 'buy' | 'equal';
};

function formatPriceValue(value: number | undefined, loading: boolean) {
  if (loading) return '…';
  return value !== undefined ? formatKamas(value) : 'Non renseigné';
}

function priceClass(value: number | undefined, recommendation: PinnedPriceSummary['recommendation'], side: 'craft' | 'buy') {
  if (value === undefined) return 'unset';
  if (recommendation === side) return 'cheaper';
  if (recommendation && recommendation !== 'equal') return 'pricier';
  return '';
}

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

// 005-pinned-item-collections US3: "Sans collection" can never be renamed or deleted (it isn't a
// real collection — it's just every item without one), so it renders as a plain heading with no
// actions, unlike a named group.
function CollectionHeading({
  name,
  onRename,
  onDelete,
}: {
  name?: string;
  onRename: (newName: string) => void;
  onDelete: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(name ?? '');

  if (!name) {
    return <h2 className="pinned-collection-title">Sans collection</h2>;
  }

  if (renaming) {
    return (
      <form
        className="pinned-collection-title pinned-collection-title-editing"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = draft.trim();
          if (trimmed) onRename(trimmed);
          setRenaming(false);
        }}
      >
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-label={`Renommer la collection ${name}`}
          autoFocus
        />
        <button type="submit" className="icon-button" aria-label="Valider le renommage">
          <Icon name="check" size={14} />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="Annuler le renommage"
          onClick={() => {
            setRenaming(false);
            setDraft(name);
          }}
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
        type="button"
        className="icon-button"
        aria-label={`Renommer la collection ${name}`}
        onClick={() => {
          setDraft(name);
          setRenaming(true);
        }}
      >
        <Icon name="edit" size={14} />
      </button>
      <button type="button" className="icon-button" aria-label={`Supprimer la collection ${name}`} onClick={onDelete}>
        <Icon name="close" size={14} />
      </button>
    </h2>
  );
}

// 005-pinned-item-collections: the single, page-level way to create a collection — items are
// assigned to it afterward from their own card, never at creation time (feedback from the earlier
// design where each card offered its own inline "create" option: too repetitive across many cards).
function NewCollectionButton({ onCreate }: { onCreate: (name: string) => void }) {
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState('');

  if (creating) {
    return (
      <form
        className="new-collection-form"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = draft.trim();
          if (trimmed) onCreate(trimmed);
          setCreating(false);
          setDraft('');
        }}
      >
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Nom de la collection"
          aria-label="Nom de la nouvelle collection"
          autoFocus
        />
        <button type="submit" className="icon-button" aria-label="Créer la collection">
          <Icon name="check" size={16} />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="Annuler la création de collection"
          onClick={() => {
            setCreating(false);
            setDraft('');
          }}
        >
          <Icon name="close" size={16} />
        </button>
      </form>
    );
  }

  return (
    <button type="button" className="settings-choice new-collection-button" onClick={() => setCreating(true)}>
      + Nouvelle collection
    </button>
  );
}

export function EpinglesPage({ priceMode }: { priceMode: PriceMode }) {
  const { pinnedItems, unpin, listCollectionNames, createCollection, assignCollection, renameCollection, deleteCollection } = usePinnedItems();
  const navigate = useNavigate();
  const { serverId } = useActiveServer();
  const [summaries, setSummaries] = useState<Record<string, PinnedPriceSummary>>({});
  const [loadingSummaries, setLoadingSummaries] = useState(true);
  // 005-pinned-item-collections: drag a card onto another collection's zone (including "Sans
  // collection") to move it there — the only way to change a card's collection on this page.
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverGroupKey, setDragOverGroupKey] = useState<string | null>(null);
  const pinnedItemIds = pinnedItems.map((entry) => entry.item.id).join(',');

  useEffect(() => {
    if (!serverId || !pinnedItemIds) {
      setSummaries({});
      setLoadingSummaries(false);
      return;
    }
    let cancelled = false;
    setLoadingSummaries(true);
    const ids = pinnedItemIds.split(',');
    (async () => {
      const [details, marketPrices] = await Promise.all([
        Promise.all(ids.map((id) => getItemDetail(id))),
        pinnedItemPrices.getMany(serverId, ids),
      ]);
      const allResourceIds = [...new Set(
        details.flatMap((detail) => detail.recipe?.ingredients.map((ingredient) => ingredient.resourceId) ?? []),
      )];
      const repository = resourcePricesFor(priceMode);
      const resourcePrices = await repository.getMany(serverId, allResourceIds);
      const summarize = () => {
        const next: Record<string, PinnedPriceSummary> = {};
        ids.forEach((id, index) => {
          const detail = details[index];
          const marketPriceKamas = marketPrices[id]?.marketPriceKamas;
          const result = detail.recipe ? compare(detail.recipe, resourcePrices, marketPriceKamas) : undefined;
          next[id] = {
            craftCostKamas: result?.craftCostStatus === 'complete' ? result.knownCraftCostKamas : undefined,
            marketPriceKamas,
            recommendation: result && result.recommendation !== 'insufficient-data' ? result.recommendation : undefined,
          };
        });
        setSummaries(next);
      };
      if (cancelled) return;
      summarize();
      setLoadingSummaries(false);
      // Mode communautaire: RecherchePage only copies a resource's community median into the carnet
      // when that item's detail is displayed, so an item pinned earlier could show "Non renseigné"
      // here while its detail page shows every price. Fill the same gaps the same way (median saved
      // into the carnet, once) so both pages agree — after the carnet values are already on screen,
      // so a slow network never delays them.
      if (priceMode !== 'community') return;
      const missingIds = allResourceIds.filter((resourceId) => !resourcePrices[resourceId]);
      if (missingIds.length === 0) return;
      await Promise.all(missingIds.map(async (resourceId) => {
        const median = await lookupCommunityMedian(resourceId, serverId);
        if (median === undefined || cancelled) return;
        resourcePrices[resourceId] = await repository.save(serverId, resourceId, median);
      }));
      if (!cancelled) summarize();
    })();
    return () => {
      cancelled = true;
    };
  }, [serverId, pinnedItemIds, priceMode]);

  return (
    <>
      <header className="page-header">
        <h1>Épinglés</h1>
        <p>Retrouvez rapidement vos objets suivis, sans refaire de recherche.</p>
      </header>
      {pinnedItems.length > 0 && (
        <div className="pinned-collections-toolbar">
          <NewCollectionButton onCreate={createCollection} />
        </div>
      )}
      {pinnedItems.length === 0 ? (
        <EmptyState
          icon="pin"
          title="Aucun objet épinglé"
          description="Épinglez un objet depuis la recherche pour le retrouver ici, quel que soit le serveur actif."
        />
      ) : (
        groupByCollection(pinnedItems, listCollectionNames()).map((group) => {
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
              <p className="pinned-collection-empty muted">Aucun objet dans cette collection pour le moment.</p>
            ) : (
            <div className="pinned-grid" aria-label={`Objets épinglés — ${group.name ?? 'Sans collection'}`}>
              {group.items.map((entry) => {
                const summary = summaries[entry.item.id];
                return (
                <div
                  className={`pinned-card${draggedItemId === entry.item.id ? ' pinned-card-dragging' : ''}`}
                  key={entry.item.id}
                  draggable
                  aria-label={`${entry.item.name} — glisser-déposer sur une autre collection pour le déplacer (actuellement : ${group.name ?? 'Sans collection'})`}
                  onDragStart={(event) => {
                    setDraggedItemId(entry.item.id);
                    event.dataTransfer.setData('text/plain', entry.item.id);
                    event.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnd={() => {
                    setDraggedItemId(null);
                    setDragOverGroupKey(null);
                  }}
                >
                  <div className="pinned-card-top">
                    <button
                      type="button"
                      className="pinned-card-main"
                      onClick={() => navigate(`${ROUTES.search}?item=${entry.item.id}`)}
                    >
                      {entry.item.imageUrl ? (
                        <img src={entry.item.imageUrl} alt="" width="40" height="40" />
                      ) : (
                        <span className="pinned-card-fallback" aria-hidden="true">
                          {entry.item.name.slice(0, 1)}
                        </span>
                      )}
                      <span className="pinned-card-info">
                        <span className="pinned-card-name">{entry.item.name}</span>
                        {entry.item.level !== undefined && (
                          <span className="pinned-card-level">Niveau {entry.item.level}</span>
                        )}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="icon-button pinned-card-remove"
                      aria-label={`Désépingler ${entry.item.name}`}
                      onClick={() => unpin(entry.item.id)}
                    >
                      <Icon name="close" size={16} />
                    </button>
                  </div>
                  <div className="pinned-card-prices">
                    <span className={`pinned-card-price ${priceClass(summary?.craftCostKamas, summary?.recommendation, 'craft')}`}>
                      Craft : {formatPriceValue(summary?.craftCostKamas, loadingSummaries)}
                    </span>
                    <span className={`pinned-card-price ${priceClass(summary?.marketPriceKamas, summary?.recommendation, 'buy')}`}>
                      HDV : {formatPriceValue(summary?.marketPriceKamas, loadingSummaries)}
                    </span>
                  </div>
                </div>
                );
              })}
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
