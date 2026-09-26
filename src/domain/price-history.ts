// specs/018-price-history-windows (revises specs/017): a price history as the Worker sends it
// (contracts/price-history-api.md) — every shared price of the last 24 hours, 7 days and 30 days —
// and the display rule of a window (data-model.md « Affichage »).

export type HistoryWindow = 'day' | 'week' | 'month';
export type SharedPrice = { amountKamas: number; sharedAt: string };
export type PriceHistory = Record<HistoryWindow, SharedPrice[]>;

// Shortest first: the order of the selector, and the order in which a longer window is looked for.
export const HISTORY_WINDOWS: HistoryWindow[] = ['day', 'week', 'month'];

export const WINDOW_LABELS: Record<HistoryWindow, string> = { day: 'Jour', week: 'Semaine', month: 'Mois' };

const HOUR = 60 * 60 * 1000;
const WINDOW_MS: Record<HistoryWindow, number> = { day: 24 * HOUR, week: 7 * 24 * HOUR, month: 30 * 24 * HOUR };

export function windowStart(window: HistoryWindow, now: number): number {
  return now - WINDOW_MS[window];
}

export type HistoryDisplay =
  | { kind: 'empty' }
  | { kind: 'none-in-window'; longerWindow?: HistoryWindow }
  | { kind: 'single'; price: SharedPrice; longerWindow?: HistoryWindow }
  | { kind: 'chart'; prices: SharedPrice[] };

// FR-007: no curve under two prices. Windows are nested, so only a longer one can hold more prices:
// the shortest longer window with at least two is offered instead (research.md §4).
export function historyDisplay(history: PriceHistory, window: HistoryWindow): HistoryDisplay {
  if (history.month.length === 0) return { kind: 'empty' };
  const prices = history[window];
  if (prices.length >= 2) return { kind: 'chart', prices };
  const longerWindow = HISTORY_WINDOWS.slice(HISTORY_WINDOWS.indexOf(window) + 1)
    .find((candidate) => history[candidate].length >= 2);
  const invite = longerWindow ? { longerWindow } : {};
  return prices.length === 1 ? { kind: 'single', price: prices[0], ...invite } : { kind: 'none-in-window', ...invite };
}

// Shown in Paris time (spec Edge Cases), whatever the viewer's time zone.
const dayFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' });
const timeFormatter = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
const hourFormatter = new Intl.DateTimeFormat('fr-FR', { hour: 'numeric', timeZone: 'Europe/Paris' });

// « 24 sept. à 14:05 »
export function formatSharedAt(time: string | number): string {
  const date = new Date(time);
  return `${dayFormatter.format(date)} à ${timeFormatter.format(date)}`;
}

// An x-axis end label: « 14 h » over 24 hours, « 22 sept. » otherwise.
export function formatAxisTick(time: number, window: HistoryWindow): string {
  const date = new Date(time);
  return window === 'day' ? hourFormatter.format(date).replace(/\s*h$/, ' h') : dayFormatter.format(date);
}
