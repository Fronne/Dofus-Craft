import { describe, expect, it } from 'vitest';
import { historyDisplay, type PriceHistory, type SharedPrice } from '../../src/domain/price-history';

// specs/018-price-history-windows FR-007, data-model.md « Affichage ».
const prices = (count: number): SharedPrice[] =>
  Array.from({ length: count }, (_, index) => ({ amountKamas: 1000 + index, sharedAt: `2026-09-2${index}T10:00:00.000Z` }));
const history = (day: number, week: number, month: number): PriceHistory =>
  ({ day: prices(day), week: prices(week), month: prices(month) });

describe('historyDisplay (specs/018 FR-007)', () => {
  it('is empty without any price over 30 days', () => {
    expect(historyDisplay(history(0, 0, 0), 'day')).toEqual({ kind: 'empty' });
  });

  it('is a chart from two prices in the window', () => {
    expect(historyDisplay(history(2, 3, 4), 'day')).toEqual({ kind: 'chart', prices: prices(2) });
  });

  it('says none in the window and offers the shortest longer window with two prices', () => {
    expect(historyDisplay(history(0, 2, 3), 'day')).toEqual({ kind: 'none-in-window', longerWindow: 'week' });
    expect(historyDisplay(history(0, 1, 3), 'day')).toEqual({ kind: 'none-in-window', longerWindow: 'month' });
  });

  it('shows a single price, with an invite when a longer window has two', () => {
    expect(historyDisplay(history(1, 2, 2), 'day')).toEqual({ kind: 'single', price: prices(1)[0], longerWindow: 'week' });
    expect(historyDisplay(history(1, 1, 1), 'week')).toEqual({ kind: 'single', price: prices(1)[0] });
  });

  it('never offers a window from the month', () => {
    expect(historyDisplay(history(0, 0, 1), 'month')).toEqual({ kind: 'single', price: prices(1)[0] });
  });
});
