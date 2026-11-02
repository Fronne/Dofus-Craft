import type { DragEvent } from 'react';
import { Icon } from '../../components/Icon';
import { formatKamas } from '../../domain/kamas';
import type { PinnedItem } from '../../persistence/pinned-items';
import { leaveThen } from '../../services/motion';
import type { PinnedPriceSummary } from './usePinnedSummaries';

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

export function PinnedCard({
  entry,
  summary,
  loadingSummaries,
  collectionNames,
  groupName,
  dragging,
  onDragStart,
  onDragEnd,
  onOpen,
  onRemove,
  onAssign,
}: {
  entry: PinnedItem;
  summary: PinnedPriceSummary | undefined;
  loadingSummaries: boolean;
  collectionNames: string[];
  groupName: string | undefined;
  dragging: boolean;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onOpen: () => void;
  onRemove: () => void;
  onAssign: (collectionName: string | undefined) => void;
}) {
  return (
    <div
      className={`pinned-card${dragging ? ' pinned-card-dragging' : ''}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="pinned-card-top">
        <button
          type="button"
          className="pinned-card-main"
          onClick={onOpen}
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
          aria-label={`Ne plus suivre ${entry.item.name}`}
          onClick={(event) => {
            // The card fades out before it goes (styles/parts).
            leaveThen(event.currentTarget.closest<HTMLElement>('.pinned-card'), onRemove);
          }}
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
      {/* Same move as dragging the card onto another list, for the keyboard and a touch screen. */}
      {collectionNames.length > 0 && (
        <select
          className="pinned-card-list"
          aria-label={`Liste de ${entry.item.name}`}
          value={groupName ?? ''}
          onChange={(event) => onAssign(event.target.value || undefined)}
        >
          <option value="">Sans liste</option>
          {collectionNames.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      )}
    </div>
  );
}
