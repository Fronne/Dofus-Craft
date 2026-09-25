import { useState } from 'react';
import { formatKamas } from '../../domain/kamas';
import { formatPeriod, type Grouping, type HistoryPoint } from '../../domain/price-history';

// specs/017-price-history-chart (contracts/price-history-ui.md « Courbe »): one series, drawn as
// inline SVG — no chart dependency for fewer than 100 points (research.md §4). Time is proportional
// on the x axis, so a gap between periods stays visible and is never filled with a value (FR-010).

const WIDTH = 320;
const HEIGHT = 150;
const PLOT = { left: 48, right: 12, top: 12, bottom: 24 };
const BASELINE = HEIGHT - PLOT.bottom;

const compactKamas = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });

function time(periodStart: string) {
  return Date.parse(`${periodStart}T00:00:00.000Z`);
}

// Short x-axis tick: the day for days and weeks, the month otherwise.
function tickLabel(periodStart: string, grouping: Grouping) {
  return formatPeriod(periodStart, grouping === 'month' ? 'month' : 'day');
}

export function PriceHistoryChart({ points, grouping }: { points: HistoryPoint[]; grouping: Grouping }) {
  const [active, setActive] = useState<number | undefined>();

  const times = points.map((point) => time(point.periodStart));
  const minTime = Math.min(...times);
  const timeSpan = Math.max(...times) - minTime || 1;
  const values = points.map((point) => point.medianAmountKamas);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  // A 10 % margin (of the range, or of the value when every point is equal) keeps marks off the
  // plot edges; the floor never goes below zero kamas.
  const margin = (rawMax - rawMin || rawMax || 1) * 0.1;
  const minValue = Math.max(0, rawMin - margin);
  const valueSpan = rawMax + margin - minValue;

  const x = (index: number) => PLOT.left + ((times[index] - minTime) / timeSpan) * (WIDTH - PLOT.left - PLOT.right);
  const y = (value: number) => PLOT.top + (1 - (value - minValue) / valueSpan) * (BASELINE - PLOT.top);
  const ticks = [minValue, minValue + valueSpan / 2, minValue + valueSpan];

  // The crosshair snaps to the point closest to the pointer's x, so the hit area is the whole plot.
  const onPlotPointerMove = (event: React.PointerEvent<SVGRectElement>) => {
    const svg = event.currentTarget.ownerSVGElement;
    const box = svg?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    const pointerX = ((event.clientX - box.left) / box.width) * WIDTH;
    let closest = 0;
    points.forEach((_, index) => {
      if (Math.abs(x(index) - pointerX) < Math.abs(x(closest) - pointerX)) closest = index;
    });
    setActive(closest);
  };

  const activePoint = active === undefined ? undefined : points[active];

  return (
    <div className="price-history-chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="price-history-svg"
        role="img"
        aria-label={`Courbe de ${points.length} médianes, de ${formatPeriod(points[0].periodStart, grouping)} à ${formatPeriod(points[points.length - 1].periodStart, grouping)}`}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line className="price-history-grid" x1={PLOT.left} x2={WIDTH - PLOT.right} y1={y(tick)} y2={y(tick)} />
            <text className="price-history-tick" x={PLOT.left - 6} y={y(tick)} textAnchor="end" dominantBaseline="middle">
              {compactKamas.format(Math.round(tick))}
            </text>
          </g>
        ))}
        <text className="price-history-tick" x={x(0)} y={HEIGHT - 6} textAnchor="start">
          {tickLabel(points[0].periodStart, grouping)}
        </text>
        <text className="price-history-tick" x={x(points.length - 1)} y={HEIGHT - 6} textAnchor="end">
          {tickLabel(points[points.length - 1].periodStart, grouping)}
        </text>
        <rect
          className="price-history-plot"
          data-baseline={BASELINE}
          x={PLOT.left}
          y={PLOT.top}
          width={WIDTH - PLOT.left - PLOT.right}
          height={BASELINE - PLOT.top}
          onPointerMove={onPlotPointerMove}
          onPointerDown={onPlotPointerMove}
          onPointerLeave={() => setActive(undefined)}
        />
        {active !== undefined && (
          <line className="price-history-crosshair" x1={x(active)} x2={x(active)} y1={PLOT.top} y2={BASELINE} />
        )}
        <polyline
          className="price-history-line"
          points={points.map((point, index) => `${x(index)},${y(point.medianAmountKamas)}`).join(' ')}
        />
        {points.map((point, index) => (
          <circle
            key={point.periodStart}
            className={`price-history-point${point.sampleSize === 1 ? ' price-history-point--single' : ''}${active === index ? ' price-history-point--active' : ''}`}
            cx={x(index)}
            cy={y(point.medianAmountKamas)}
            r={4}
            tabIndex={0}
            aria-label={`${formatPeriod(point.periodStart, grouping)} : ${formatKamas(point.medianAmountKamas)}, ${point.sampleSize} prix`}
            onFocus={() => setActive(index)}
            onBlur={() => setActive(undefined)}
            onPointerEnter={() => setActive(index)}
          />
        ))}
      </svg>
      {activePoint && active !== undefined && (
        <div
          // Near an edge, the tooltip is aligned on that side instead of centered, so it stays in the panel.
          className={`price-history-tooltip${x(active) < WIDTH * 0.3 ? ' price-history-tooltip--start' : x(active) > WIDTH * 0.7 ? ' price-history-tooltip--end' : ''}`}
          role="status"
          style={{
            left: `${(x(active) / WIDTH) * 100}%`,
            top: `${(y(activePoint.medianAmountKamas) / HEIGHT) * 100}%`,
          }}
        >
          <strong>{formatKamas(activePoint.medianAmountKamas)}</strong>
          <span>{formatPeriod(activePoint.periodStart, grouping)} · {activePoint.sampleSize} prix</span>
        </div>
      )}
      {/* The same values as a table, for screen readers (the tooltip only enhances, never gates). */}
      <table className="visually-hidden">
        <thead>
          <tr><th scope="col">Période</th><th scope="col">Médiane</th><th scope="col">Nombre de prix</th></tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.periodStart}>
              <td>{formatPeriod(point.periodStart, grouping)}</td>
              <td>{formatKamas(point.medianAmountKamas)}</td>
              <td>{point.sampleSize}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
