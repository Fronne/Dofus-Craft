import { GROUPINGS, type Grouping } from '../domain/price-history';

// specs/017-price-history-chart FR-007: the last grouping picked in a price-history popover, kept on
// this device only. Missing, unreadable or unknown values — or no localStorage at all — give the week.
const STORAGE_KEY = 'craftcheck-history-grouping';
const DEFAULT_GROUPING: Grouping = 'week';

function isGrouping(value: string | null): value is Grouping {
  return GROUPINGS.includes(value as Grouping);
}

export function readHistoryGrouping(): Grouping {
  let stored: string | null;
  try {
    stored = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return DEFAULT_GROUPING;
  }
  return isGrouping(stored) ? stored : DEFAULT_GROUPING;
}

export function saveHistoryGrouping(grouping: Grouping): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, grouping);
  } catch {
    // localStorage unavailable — the choice just lasts for this visit.
  }
}
