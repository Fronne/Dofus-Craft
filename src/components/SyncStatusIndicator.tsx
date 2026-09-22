import { formatRelativeTime } from '../domain/time';

// specs/010-search-instant-cache: discreet, non-blocking signal of how fresh the data currently on
// screen is. `isRevalidating` always wins over `offline` (FR-012) — a fresh revalidation attempt is
// in progress even if a previous one had failed. When both are false, nothing is rendered except a
// minimal, hoverable marker carrying the last successful sync time when known (FR-013) — kept out
// of the way rather than shown as running text, per the "discret" requirement in spec.md.
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
  if (lastSyncedAt) {
    return (
      <span
        className="sync-status sync-status-idle"
        title={`Dernière synchronisation : ${formatRelativeTime(lastSyncedAt)}`}
      />
    );
  }
  return null;
}
