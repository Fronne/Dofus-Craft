import { useState } from 'react';
import { formatKamas } from '../../domain/kamas';
import { formatAxisTick, formatSharedAt, windowStart, type HistoryWindow, type SharedPrice } from '../../domain/price-history';

// specs/018-price-history-windows (contracts/price-history-ui.md « Courbe »): one point per shared
// price, drawn as inline SVG. The x axis spans the whole window, from its start to the load time, so
// the real gaps between prices show and nothing is drawn where no price was shared (FR-008).

const WIDTH = 320;
const HEIGHT = 150;
const PLOT = { left: 48, right: 12, top: 12, bottom: 24 };
const BASELINE = HEIGHT - PLOT.bottom;

const compactKamas = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });

export function PriceHistoryChart({ prices, window, now }: { prices: SharedPrice[]; window: HistoryWindow; now: number }) {
  const [active, setActive] = useState<number | undefined>();

  const start = windowStart(window, now);
  const timeSpan = now - start;
  const times = prices.map((price) => Date.parse(price.sharedAt));
  const values = prices.map((price) => price.amountKamas);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  // A 10 % margin (of the range, or of the value when every price is equal) keeps marks off the
  // plot edges; the floor never goes below zero kamas.
  const margin = (rawMax - rawMin || rawMax || 1) * 0.1;
  const minValue = Math.max(0, rawMin - margin);
  const valueSpan = rawMax + margin - minValue;

  const x = (index: number) => PLOT.left + ((times[index] - start) / timeSpan) * (WIDTH - PLOT.left - PLOT.right);
  const y = (value: number) => PLOT.top + (1 - (value - minValue) / valueSpan) * (BASELINE - PLOT.top);
  const ticks = [minValue, minValue + valueSpan / 2, minValue + valueSpan];

  // The crosshair snaps to the price closest to the pointer's x, so the hit area is the whole plot.
  const onPlotPointerMove = (event: React.PointerEvent<SVGRectElement>) => {
    const svg = event.currentTarget.ownerSVGElement;
    const box = svg?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    const pointerX = ((event.clientX - box.left) / box.width) * WIDTH;
    let closest = 0;
    prices.forEach((_, index) => {
      if (Math.abs(x(index) - pointerX) < Math.abs(x(closest) - pointerX)) closest = index;
    });
    setActive(closest);
  };

  const activePrice = active === undefined ? undefined : prices[active];

  return (
    <div className="price-history-chart">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="price-history-svg" role="img" aria-label={`Courbe de ${prices.length} prix`}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line className="price-history-grid" x1={PLOT.left} x2={WIDTH - PLOT.right} y1={y(tick)} y2={y(tick)} />
            <text className="price-history-tick" x={PLOT.left - 6} y={y(tick)} textAnchor="end" dominantBaseline="middle">
              {compactKamas.format(Math.round(tick))}
            </text>
          </g>
        ))}
        <text className="price-history-tick" x={PLOT.left} y={HEIGHT - 6} textAnchor="start">
          {formatAxisTick(start, window)}
        </text>
        <text className="price-history-tick" x={WIDTH - PLOT.right} y={HEIGHT - 6} textAnchor="end">
          {formatAxisTick(now, window)}
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
          points={prices.map((price, index) => `${x(index)},${y(price.amountKamas)}`).join(' ')}
        />
        {prices.map((price, index) => (
          <circle
            // Two prices can share the same minute: the index keeps each one its own point.
            key={index}
            className={`price-history-point${active === index ? ' price-history-point--active' : ''}`}
            cx={x(index)}
            cy={y(price.amountKamas)}
            r={4}
            tabIndex={0}
            aria-label={`${formatSharedAt(price.sharedAt)} : ${formatKamas(price.amountKamas)}`}
            onFocus={() => setActive(index)}
            onBlur={() => setActive(undefined)}
            onPointerEnter={() => setActive(index)}
          />
        ))}
      </svg>
      {activePrice && active !== undefined && (
        <div
          // Near an edge, the tooltip is aligned on that side instead of centered, so it stays in the panel.
          className={`price-history-tooltip${x(active) < WIDTH * 0.3 ? ' price-history-tooltip--start' : x(active) > WIDTH * 0.7 ? ' price-history-tooltip--end' : ''}`}
          role="status"
          style={{
            left: `${(x(active) / WIDTH) * 100}%`,
            top: `${(y(activePrice.amountKamas) / HEIGHT) * 100}%`,
          }}
        >
          <strong>{formatKamas(activePrice.amountKamas)}</strong>
          <span>{formatSharedAt(activePrice.sharedAt)}</span>
        </div>
      )}
      {/* The same values as a table, for screen readers (the tooltip only enhances, never gates). */}
      <table className="visually-hidden">
        <thead>
          <tr><th scope="col">Date</th><th scope="col">Prix</th></tr>
        </thead>
        <tbody>
          {prices.map((price, index) => (
            <tr key={index}>
              <td>{formatSharedAt(price.sharedAt)}</td>
              <td>{formatKamas(price.amountKamas)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
