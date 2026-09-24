import { useRef } from 'react';
import type { Item } from '../../domain/types';
import { EmptyState } from '../../components/EmptyState';
import { SkeletonCard } from '../../components/SkeletonCard';
import { SyncStatusIndicator } from '../../components/SyncStatusIndicator';

// How many more results each « Afficher plus » click reveals (also the initial page size).
export const RESULTS_PAGE_SIZE = 12;

export function ItemResults({
  items,
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
}) {
  const resultsTopRef = useRef<HTMLDivElement>(null);
  const syncStatus = <SyncStatusIndicator isRevalidating={isRevalidating} offline={offline} lastSyncedAt={lastSyncedAt} />;
  // specs/010-search-instant-cache, FR-005: only show the skeleton when there is truly nothing to
  // display yet (first visit, no cache) — once a list is already on screen, a background
  // revalidation must never replace it with a skeleton (that would also discard the user's scroll
  // position for no reason).
  // With no results bar to host it, the sync status sits on its own line above the placeholder.
  if (loading && !items.length) return <>{syncStatus}<SkeletonCard count={Math.min(resultLimit, RESULTS_PAGE_SIZE)} /></>;
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
  const canCollapse = resultLimit > RESULTS_PAGE_SIZE;
  // Back to one page, then bring the top of the results into view — otherwise the page, now much
  // shorter, leaves the player further down (on the item detail) with no sign of what happened.
  const collapse = () => {
    setResultLimit(RESULTS_PAGE_SIZE);
    resultsTopRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };
  return (
    <div>
      <div className="results-meta" ref={resultsTopRef}>
        {/* While the catalogue is revalidating or the total count is still being computed, a single
            "Mise à jour…" takes the count's spot; the offline notice sits next to the count instead. */}
        {isRevalidating || totalPending ? (
          <SyncStatusIndicator isRevalidating offline={false} />
        ) : (
          <span className="results-meta-count">
            <span>{total} {total === 1 ? 'objet trouvé' : 'objets trouvés'}</span>
            {syncStatus}
          </span>
        )}
      </div>
      <div className="results" aria-label="Résultats de recherche">
        {items.map((item) => (
          <button className={selected === item.id ? 'selected' : ''} onClick={() => onSelect(item.id)} key={item.id}>
            {item.imageUrl ? (
              <img src={item.imageUrl} alt="" loading="lazy" width="32" height="32" />
            ) : (
              <span className="result-image-fallback" aria-hidden="true">{item.name.slice(0, 1)}</span>
            )}
            <span className="result-item-info">
              <span className="result-item-name">{item.name}</span>
              {item.level !== undefined && <span className="result-item-level"> Niveau {item.level}</span>}
            </span>
          </button>
        ))}
      </div>
      {(hasMore || canCollapse) && (
        <div className="results-more">
          <div className="results-more-actions">
            {hasMore && (
              <button
                type="button"
                className="btn btn-secondary btn-small"
                disabled={isRevalidating}
                onClick={() => setResultLimit(resultLimit + RESULTS_PAGE_SIZE)}
              >
                Afficher {RESULTS_PAGE_SIZE} de plus
              </button>
            )}
            {canCollapse && (
              <button type="button" className="results-collapse" onClick={collapse}>
                Réduire
              </button>
            )}
          </div>
          {!totalPending && <span className="results-more-count">{items.length} sur {total}</span>}
        </div>
      )}
    </div>
  );
}
