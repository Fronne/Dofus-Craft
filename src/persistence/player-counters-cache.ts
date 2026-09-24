import { isPlayerCounter, type PlayerCounter } from '../domain/player-counter';

// specs/014-admin-counters, FR-004: the last list of counters received, shown when the service
// can't be reached. Never a made-up list: nothing cached means no bubbles.
const KEY = 'craftcheck-player-counters';

export function readCachedCounters(): PlayerCounter[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) && parsed.every(isPlayerCounter) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeCachedCounters(counters: PlayerCounter[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(counters));
  } catch {
    // localStorage unavailable — the counters just won't show offline.
  }
}
