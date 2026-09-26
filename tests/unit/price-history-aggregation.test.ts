import { describe, expect, it } from 'vitest';
import { computePriceHistory, type HistoryRow } from '../../worker/src/price-history';

// specs/018-price-history-windows (contracts/price-history-api.md « Tests obligatoires »).
const NOW = new Date('2026-09-25T12:00:00.000Z');
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function ago(ms: number): string {
  return new Date(NOW.getTime() - ms).toISOString();
}

function row(amountKamas: number, createdAt: string): HistoryRow {
  return { amountKamas, createdAt };
}

describe('computePriceHistory (specs/018)', () => {
  it('returns three empty windows without any row', () => {
    expect(computePriceHistory([], NOW)).toEqual({ day: [], week: [], month: [] });
  });

  it('puts each price in every window that contains it', () => {
    const history = computePriceHistory([row(1000, ago(2 * HOUR)), row(1100, ago(3 * DAY)), row(1200, ago(20 * DAY))], NOW);
    expect(history.day.map((price) => price.amountKamas)).toEqual([1000]);
    expect(history.week.map((price) => price.amountKamas)).toEqual([1100, 1000]);
    expect(history.month.map((price) => price.amountKamas)).toEqual([1200, 1100, 1000]);
  });

  it.each([
    ['day', DAY],
    ['week', 7 * DAY],
    ['month', 30 * DAY],
  ] as const)('includes the %s window start and excludes one minute before', (window, length) => {
    const history = computePriceHistory([row(1000, ago(length)), row(2000, ago(length + MINUTE))], NOW);
    expect(history[window].map((price) => price.amountKamas)).toEqual([1000]);
  });

  it('keeps every price of the same device, even within the hour', () => {
    const history = computePriceHistory([row(1000, ago(50 * MINUTE)), row(1100, ago(30 * MINUTE)), row(1300, ago(10 * MINUTE))], NOW);
    expect(history.day).toHaveLength(3);
  });

  it('drops an outlier only from the window where it is one', () => {
    // In « day », 1000 is among 4 values including 9000; in « week », more low values make 9000 the outlier.
    const rows = [
      row(1000, ago(5 * DAY)), row(1010, ago(5 * DAY)), row(1020, ago(5 * DAY)), row(1030, ago(5 * DAY)),
      row(9000, ago(HOUR)),
    ];
    const history = computePriceHistory(rows, NOW);
    expect(history.day.map((price) => price.amountKamas)).toEqual([9000]);
    expect(history.week.map((price) => price.amountKamas)).not.toContain(9000);
  });

  it('sorts oldest first and rounds the time down to the minute, with no other field', () => {
    const history = computePriceHistory([row(1100, '2026-09-25T10:05:59.999Z'), row(1000, '2026-09-25T08:14:30.000Z')], NOW);
    expect(history.day).toEqual([
      { amountKamas: 1000, sharedAt: '2026-09-25T08:14:00.000Z' },
      { amountKamas: 1100, sharedAt: '2026-09-25T10:05:00.000Z' },
    ]);
  });
});
