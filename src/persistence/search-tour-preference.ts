const STORAGE_KEY = 'craftcheck-search-tour-seen';

// specs/011-search-onboarding, FR-010: whether the Recherche page's guided tour was already finished
// or dismissed on this device — kept only in localStorage, never sent anywhere. An unavailable
// storage reads as "not seen" and silently drops the write: the tour may then show again on the
// next visit, but always stays dismissable (spec.md edge cases).
export function hasSeenSearchTour(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markSearchTourSeen(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // localStorage unavailable — the tour will just show again next time.
  }
}
