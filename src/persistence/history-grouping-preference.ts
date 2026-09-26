import { HISTORY_WINDOWS, type HistoryWindow } from '../domain/price-history';

// specs/018-price-history-windows FR-002 (key and values kept from specs/017): the last window picked
// in a price-history popover, kept on this device only. Missing, unreadable or unknown values — or no
// localStorage at all — give the week.
const STORAGE_KEY = 'craftcheck-history-grouping';
const DEFAULT_GROUPING: HistoryWindow = 'week';

function isHistoryWindow(value: string | null): value is HistoryWindow {
  return HISTORY_WINDOWS.includes(value as HistoryWindow);
}

export function readHistoryGrouping(): HistoryWindow {
  let stored: string | null;
  try {
    stored = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return DEFAULT_GROUPING;
  }
  return isHistoryWindow(stored) ? stored : DEFAULT_GROUPING;
}

export function saveHistoryGrouping(grouping: HistoryWindow): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, grouping);
  } catch {
    // localStorage unavailable — the choice just lasts for this visit.
  }
}
