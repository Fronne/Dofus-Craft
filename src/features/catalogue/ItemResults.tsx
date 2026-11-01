import { useRef, useState } from 'react';
import type { Item } from '../../domain/types';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonCard } from '../../components/SkeletonCard';
import { SyncStatusIndicator } from '../../components/SyncStatusIndicator';
import { ItemCarousel } from '../brisage/ItemCarousel';

// specs/051-site-visual-refresh (FR-018): the first page shows 6 results, so the chosen item's
// detail stays close to the search field.
export const RESULTS_PAGE_SIZE = 6;
// How many more results each « Afficher plus » click reveals.
export const RESULTS_MORE_STEP = 12;

export function ItemResults({
  items: itemsProp,
  selected,
  onSelect,
  loading,
  total,
  totalPending,
  resultLimit,
  setResultLimit,
  isRevalidating = false,
  offline = false,
  lastSyncedAt,
  error = '',
  onRetry,
}: {
  items: Item[];
  selected?: string;
  onSelect: (id: string) => void;
  loading?: boolean;
  total: number;
  totalPending?: boolean;
  resultLimit: number;
  setResultLimit: (value: number) => void;
  isRevalidating?: boolean;
  offline?: boolean;
  lastSyncedAt?: string;
  // Why nothing could be loaded at all (no result and no local copy), with a way to ask again.
  error?: string;
  onRetry?: () => void;
}) {
  // How many cards the player has scrolled past, up to the last one fully in view.
  const [seen, setSeen] = useState(0);
  // Asking for more results is a new search for the data layer: for a moment there is nothing at all. The row
  // then keeps the cards it had, so it stays where it was instead of going back to a skeleton and to the start.
  const held = useRef<Item[]>([]);
  const askedAt = useRef(0);
  if (itemsProp.length && itemsProp[0].id !== held.current[0]?.id) askedAt.current = 0;
  if (itemsProp.length > askedAt.current) askedAt.current = 0;
  if (itemsProp.length) held.current = itemsProp;
  const holding = !itemsProp.length && !!loading && askedAt.current > 0;
  const items = holding ? held.current : itemsProp;
  const syncStatus = <SyncStatusIndicator isRevalidating={isRevalidating} offline={offline} lastSyncedAt={lastSyncedAt} />;
  // specs/010-search-instant-cache, FR-005: only show the skeleton when there is truly nothing to
  // display yet (first visit, no cache) — once a list is already on screen, a background
  // revalidation must never replace it with a skeleton (that would also discard the user's scroll
  // position for no reason).
  // With no results bar to host it, the sync status sits on its own line above the placeholder.
  if (loading && !items.length) {
    return (
      <>
        {syncStatus}
        <span className="visually-hidden" role="status">Chargement des objets…</span>
        <SkeletonCard count={Math.min(resultLimit, RESULTS_PAGE_SIZE)} />
      </>
    );
  }
  // A failed load is not an empty search: it says so, and offers to try again.
  if (!items.length && error) {
    return (
      <div role="alert">
        <EmptyState icon="info" title="Impossible de charger les objets" description={error}>
          {onRetry && <button type="button" className="btn btn-primary" onClick={onRetry}>Réessayer</button>}
        </EmptyState>
      </div>
    );
  }
  if (!items.length) {
    return (
      <>
      {syncStatus}
      <EmptyState
        icon="search"
        title="Aucun objet ne correspond à votre recherche"
        description="Essayez d'élargir vos filtres ou de vérifier l'orthographe de votre recherche."
      />
      </>
    );
  }
  // While the total is still being computed it isn't reliable yet, so a full page is the only hint
  // that more results may exist.
  const hasMore = totalPending ? items.length >= resultLimit : items.length < total;
  return (
    <div className="results-block">
      {/* One line: how many were found. */}
      <div className="results-meta">
        {/* While the catalogue is revalidating or the total count is still being computed, a single
            "Mise à jour…" takes the count's spot; the offline notice sits next to the count instead. */}
        {isRevalidating || totalPending || holding ? (
          <SyncStatusIndicator isRevalidating offline={false} />
        ) : (
          <span className="results-meta-count">
            <span>{total} {total === 1 ? 'objet trouvé' : 'objets trouvés'}</span>
            {seen > 0 && total > 1 && <span className="results-position">{Math.min(seen, total)} vus</span>}
            {syncStatus}
          </span>
        )}
      </div>
      {/* A row of cards that scrolls sideways; near its right end the next results are asked for. */}
      {/* A new search starts a new row (back at the first card); more results of the same search keep the place. */}
      <ItemCarousel
        key={items[0]?.id}
        total={hasMore ? Math.max(total, items.length + 1) : items.length}
        shown={items.length}
        onVisibleEnd={setSeen}
        // Only once the results asked for are all here: while a request is pending, the many scroll events
        // must not pile more on top of it.
        onNearEnd={() => {
          if (!hasMore || isRevalidating || holding || items.length < resultLimit) return;
          askedAt.current = items.length;
          setResultLimit(items.length + RESULTS_MORE_STEP);
        }}
      >
        {items.map((item) => (
          <li key={item.id}>
            <button type="button" className={selected === item.id ? 'selected' : undefined} aria-pressed={selected === item.id} onClick={() => onSelect(item.id)}>
              <span className="brisage-card-image">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" loading="lazy" width="36" height="36" />
                ) : (
                  <span className="result-image-fallback" aria-hidden="true">{item.name.slice(0, 1)}</span>
                )}
              </span>
              <span className="result-item-info">
                <span className="result-item-name" title={item.name}>{item.name}</span>
                {item.level !== undefined && <span className="brisage-card-level">Niveau {item.level}</span>}
              </span>
            </button>
          </li>
        ))}
      </ItemCarousel>
    </div>
  );
}
