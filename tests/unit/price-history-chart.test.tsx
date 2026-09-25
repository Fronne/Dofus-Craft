import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PriceHistoryChart } from '../../src/features/comparison/PriceHistoryChart';
import type { HistoryPoint } from '../../src/domain/price-history';

// specs/017-price-history-chart, contracts/price-history-ui.md « Courbe ».
const POINTS: HistoryPoint[] = [
  { periodStart: '2026-08-31', medianAmountKamas: 1200, sampleSize: 3 },
  { periodStart: '2026-09-07', medianAmountKamas: 1300, sampleSize: 2 },
  { periodStart: '2026-09-28', medianAmountKamas: 1250, sampleSize: 1 },
];

function pointXs(container: HTMLElement) {
  return [...container.querySelectorAll<SVGCircleElement>('.price-history-point')].map((circle) => Number(circle.getAttribute('cx')));
}

describe('PriceHistoryChart (specs/017)', () => {
  afterEach(cleanup);

  it('draws one point per period', () => {
    const { container } = render(<PriceHistoryChart points={POINTS} grouping="week" />);
    expect(container.querySelectorAll('.price-history-point')).toHaveLength(3);
  });

  it('keeps time proportional: a 3-week gap is three times a 1-week gap (FR-010)', () => {
    const { container } = render(<PriceHistoryChart points={POINTS} grouping="week" />);
    const [first, second, third] = pointXs(container);
    expect(third - second).toBeCloseTo(3 * (second - first), 5);
  });

  it('shows period, median and count on keyboard focus or hover', () => {
    const { container } = render(<PriceHistoryChart points={POINTS} grouping="week" />);
    const circles = container.querySelectorAll('.price-history-point');
    fireEvent.focus(circles[1]);
    const tooltip = screen.getByRole('status');
    expect(tooltip).toHaveTextContent('1 300 kamas');
    expect(tooltip).toHaveTextContent('semaine du 7 sept.');
    expect(tooltip).toHaveTextContent('2 prix');
    fireEvent.pointerEnter(circles[0]);
    expect(screen.getByRole('status')).toHaveTextContent('1 200 kamas');
  });

  it('marks a single-price point as hollow and says "1 prix"', () => {
    const { container } = render(<PriceHistoryChart points={POINTS} grouping="week" />);
    const circles = container.querySelectorAll('.price-history-point');
    expect(circles[2]).toHaveClass('price-history-point--single');
    expect(circles[0]).not.toHaveClass('price-history-point--single');
    fireEvent.focus(circles[2]);
    expect(screen.getByRole('status')).toHaveTextContent('1 prix');
  });

  it('never places a point at zero kamas', () => {
    const { container } = render(<PriceHistoryChart points={POINTS} grouping="week" />);
    const ys = [...container.querySelectorAll('.price-history-point')].map((circle) => Number(circle.getAttribute('cy')));
    const baseline = Number(container.querySelector('.price-history-plot')?.getAttribute('data-baseline'));
    expect(ys.every((y) => y < baseline)).toBe(true);
  });

  it('offers the values as a table for assistive technologies', () => {
    render(<PriceHistoryChart points={POINTS} grouping="week" />);
    expect(screen.getAllByRole('row')).toHaveLength(4);
  });
});
