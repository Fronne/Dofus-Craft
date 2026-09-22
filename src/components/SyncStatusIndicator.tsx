import { formatRelativeTime } from '../domain/time';

// specs/010-search-instant-cache: discreet, non-blocking signal of how fresh the data currently on
// screen is. `isRevalidating` always wins over `offline` (FR-012) — a fresh revalidation attempt is
// in progress even if a previous one had failed. Once everything is settled and online, nothing is
// rendered at all (FR-013's "last sync time" affordance was dropped: a lone dot sitting in empty
// space below the category filters read as a stray UI element, not as information — see the
// screenshot feedback that prompted this).
export function SyncStatusIndicator({
  isRevalidating,
  offline,
  lastSyncedAt,
}: {
  isRevalidating: boolean;
  offline: boolean;
  lastSyncedAt?: string;
}) {
  if (isRevalidating) {
    return (
      <span className="sync-status sync-status-revalidating" role="status">
        <span className="loading-spinner" aria-hidden="true" />
        Mise à jour…
      </span>
    );
  }
  if (offline) {
    return (
      <span className="sync-status sync-status-offline" role="status">
        Données hors ligne
        {lastSyncedAt && ` — dernière mise à jour : ${formatRelativeTime(lastSyncedAt)}`}
      </span>
    );
  }
  return null;
}
