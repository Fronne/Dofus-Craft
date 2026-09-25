// specs/017-price-history-chart: a price history as the Worker sends it (contracts/price-history-api.md)
// and the display rule of a grouping (data-model.md). Points are already aggregated per period.

export type Grouping = 'day' | 'week' | 'month';
export type HistoryPoint = { periodStart: string; medianAmountKamas: number; sampleSize: number };
export type PriceHistory = Record<Grouping, HistoryPoint[]>;

// Finest first: the order of the selector, and the order in which a finer grouping is looked for.
export const GROUPINGS: Grouping[] = ['day', 'week', 'month'];

export const GROUPING_LABELS: Record<Grouping, string> = { day: 'Jour', week: 'Semaine', month: 'Mois' };

export type HistoryDisplay =
  | { kind: 'empty' }
  | { kind: 'single'; point: HistoryPoint; finerGrouping?: Grouping }
  | { kind: 'chart'; points: HistoryPoint[] };

// FR-009: no curve under two periods. With one, the closest finer grouping that does have two
// periods (if any) is offered instead (US4).
export function historyDisplay(history: PriceHistory, grouping: Grouping): HistoryDisplay {
  const points = history[grouping];
  if (points.length === 0) return { kind: 'empty' };
  if (points.length >= 2) return { kind: 'chart', points };
  const finer = GROUPINGS.slice(0, GROUPINGS.indexOf(grouping)).reverse();
  const finerGrouping = finer.find((candidate) => history[candidate].length >= 2);
  return finerGrouping ? { kind: 'single', point: points[0], finerGrouping } : { kind: 'single', point: points[0] };
}

// `periodStart` is a civil date: read and formatted in UTC so no time zone can shift it by a day.
const dayFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const monthFormatter = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: 'numeric', timeZone: 'UTC' });

export function formatPeriod(periodStart: string, grouping: Grouping): string {
  const date = new Date(`${periodStart}T00:00:00.000Z`);
  if (grouping === 'month') return monthFormatter.format(date);
  const day = dayFormatter.format(date);
  return grouping === 'week' ? `semaine du ${day}` : day;
}
