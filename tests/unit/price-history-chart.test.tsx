import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PriceHistoryChart } from '../../src/features/comparison/PriceHistoryChart';
import type { SharedPrice } from '../../src/domain/price-history';

// specs/018-price-history-windows, contracts/price-history-ui.md « Courbe ». Paris is UTC+2 here.
const NOW = Date.parse('2026-09-25T12:00:00.000Z');
const PRICES: SharedPrice[] = [
  { amountKamas: 1200, sharedAt: '2026-09-19T12:00:00.000Z' },
  { amountKamas: 1300, sharedAt: '2026-09-20T12:00:00.000Z' },
  { amountKamas: 1250, sharedAt: '2026-09-23T12:00:00.000Z' },
];

function pointXs(container: HTMLElement) {
  return [...container.querySelectorAll<SVGCircleElement>('.price-history-point')].map((circle) => Number(circle.getAttribute('cx')));
}

describe('PriceHistoryChart (specs/018)', () => {
  afterEach(cleanup);

  it('draws one point per price, even two at the same minute', () => {
    const { container } = render(<PriceHistoryChart prices={[...PRICES, { amountKamas: 1260, sharedAt: PRICES[2].sharedAt }]} window="week" now={NOW} />);
    expect(container.querySelectorAll('.price-history-point')).toHaveLength(4);
  });

  it('keeps time proportional over the whole window (FR-008)', () => {
    const { container } = render(<PriceHistoryChart prices={PRICES} window="week" now={NOW} />);
    const [first, second, third] = pointXs(container);
    expect(third - second).toBeCloseTo(3 * (second - first), 5);
    // The window starts 7 days before now: the first price, 6 days ago, is not on the left edge.
    const plot = container.querySelector('.price-history-plot');
    const left = Number(plot?.getAttribute('x'));
    const width = Number(plot?.getAttribute('width'));
    expect(first).toBeCloseTo(left + width / 7, 5);
  });

  it('shows the price, the date and the time in Paris on focus or hover', () => {
    const { container } = render(<PriceHistoryChart prices={PRICES} window="week" now={NOW} />);
    const circles = container.querySelectorAll('.price-history-point');
    fireEvent.focus(circles[1]);
    const tooltip = screen.getByRole('status');
    expect(tooltip).toHaveTextContent('1 300 kamas');
    expect(tooltip).toHaveTextContent('20 sept. à 14:00');
    fireEvent.pointerEnter(circles[0]);
    expect(screen.getByRole('status')).toHaveTextContent('1 200 kamas');
  });

  it('labels the axis in hours over a day and in days otherwise', () => {
    const day = render(<PriceHistoryChart prices={[PRICES[2], PRICES[2]]} window="day" now={NOW} />);
    expect(day.container.textContent).toContain('14 h');
    cleanup();
    const week = render(<PriceHistoryChart prices={PRICES} window="week" now={NOW} />);
    expect(week.container.textContent).toContain('18 sept.');
    expect(week.container.textContent).toContain('25 sept.');
  });

  it('never places a point at zero kamas', () => {
    const { container } = render(<PriceHistoryChart prices={PRICES} window="week" now={NOW} />);
    const ys = [...container.querySelectorAll('.price-history-point')].map((circle) => Number(circle.getAttribute('cy')));
    const baseline = Number(container.querySelector('.price-history-plot')?.getAttribute('data-baseline'));
    expect(ys.every((y) => y < baseline)).toBe(true);
  });

  it('offers the values as a date / price table for assistive technologies', () => {
    render(<PriceHistoryChart prices={PRICES} window="week" now={NOW} />);
    expect(screen.getAllByRole('row')).toHaveLength(4);
    expect(screen.getByRole('columnheader', { name: 'Date' })).toBeInTheDocument();
  });
});
