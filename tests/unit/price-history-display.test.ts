import { describe, expect, it } from 'vitest';
import { formatPeriod, historyDisplay, type HistoryPoint, type PriceHistory } from '../../src/domain/price-history';

// specs/017-price-history-chart, data-model.md « Affichage d'un regroupement ».
const point = (periodStart: string, medianAmountKamas = 1000, sampleSize = 1): HistoryPoint =>
  ({ periodStart, medianAmountKamas, sampleSize });
const points = (count: number) => Array.from({ length: count }, (_, index) => point(`2026-09-${String(index + 10)}`));
const history = (day: number, week: number, month: number): PriceHistory =>
  ({ day: points(day), week: points(week), month: points(month) });

describe('historyDisplay (specs/017 FR-009)', () => {
  it('is empty without any point', () => {
    expect(historyDisplay(history(0, 0, 0), 'week')).toEqual({ kind: 'empty' });
  });

  it('is a chart from two points', () => {
    expect(historyDisplay(history(3, 3, 3), 'day')).toEqual({ kind: 'chart', points: points(3) });
  });

  it('offers the week when the month has one point and the week two', () => {
    expect(historyDisplay(history(2, 2, 1), 'month')).toMatchObject({ kind: 'single', finerGrouping: 'week' });
  });

  it('offers the day when the month and the week have one point and the day three', () => {
    expect(historyDisplay(history(3, 1, 1), 'month')).toMatchObject({ kind: 'single', finerGrouping: 'day' });
  });

  it('offers nothing finer than the day', () => {
    const display = historyDisplay(history(1, 1, 1), 'day');
    expect(display).toEqual({ kind: 'single', point: points(1)[0] });
  });
});

describe('formatPeriod (specs/017)', () => {
  it('labels a day, a week and a month', () => {
    expect(formatPeriod('2026-09-21', 'day')).toBe('21 sept.');
    expect(formatPeriod('2026-09-14', 'week')).toBe('semaine du 14 sept.');
    expect(formatPeriod('2026-09-01', 'month')).toBe('sept. 2026');
  });

  it('never shifts the first of a month to the previous one', () => {
    expect(formatPeriod('2026-10-01', 'day')).toBe('1 oct.');
    expect(formatPeriod('2026-10-01', 'month')).toBe('oct. 2026');
  });
});
