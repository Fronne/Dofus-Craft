import { USAGE_LABELS, USAGE_LIMITS, USAGE_METRICS, usagePercent, type UsageDay } from '../src/domain/cloudflare-usage';
import type { CSSProperties } from 'react';
import { USAGE_SHORT, USAGE_STYLE } from './usage-style';
import { PILL_HEIGHT, areaPath, placePills, smoothPath } from './chart-paths';

const WIDTH = 600;
const HEIGHT = 170;
// The right margin holds the pill at the end of each curve.
const PAD = { left: 40, right: 124, top: 10, bottom: 22 };

const dayLabel = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;
const group = new Intl.NumberFormat('fr-FR');

// specs/058-admin-cloudflare-usage (US2): the three metrics as a percentage of their daily limit, one point
// per UTC day. The values are also given as a table for screen readers.
export function UsageChart({ history }: { history: UsageDay[] }) {
  const percents = history.map((day) => USAGE_METRICS.map((metric) => usagePercent(day[metric], USAGE_LIMITS[metric])));
  const top = Math.max(100, ...percents.flat());
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const x = (index: number) => PAD.left + (history.length < 2 ? plotWidth / 2 : (index / (history.length - 1)) * plotWidth);
  const y = (percent: number) => PAD.top + plotHeight - (percent / top) * plotHeight;

  const baseline = y(0);
  const lastIndex = history.length - 1;
  const pills = placePills(
    USAGE_METRICS.map((metric, metricIndex) => ({
      id: metric,
      text: `${USAGE_SHORT[metric]} ${percents[lastIndex][metricIndex]} %`,
      endX: x(lastIndex),
      endY: y(percents[lastIndex][metricIndex]),
    })),
    WIDTH,
    PAD.top,
    baseline,
  );

  return (
    <figure className="usage-chart">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`Consommation des ${history.length} derniers jours, en pourcentage de la limite quotidienne`}>
        <defs>
          {USAGE_METRICS.map((metric) => (
            <linearGradient key={metric} id={`usage-area-${metric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={USAGE_STYLE[metric].stroke} stopOpacity="0.32" />
              <stop offset="1" stopColor={USAGE_STYLE[metric].stroke} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(50)} y2={y(50)} className="chart-grid" />
        <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(100)} y2={y(100)} className="usage-chart-limit" />
        <text x={PAD.left - 6} y={y(100) + 3} textAnchor="end" className="usage-chart-axis">100 %</text>
        <text x={PAD.left - 6} y={y(50) + 3} textAnchor="end" className="usage-chart-axis">50 %</text>
        <text x={PAD.left - 6} y={y(0) + 3} textAnchor="end" className="usage-chart-axis">0</text>
        <text x={PAD.left} y={HEIGHT - 4} className="usage-chart-axis">{dayLabel(history[0].date)}</text>
        <text x={WIDTH - PAD.right} y={HEIGHT - 4} textAnchor="end" className="usage-chart-axis">{dayLabel(history[history.length - 1].date)}</text>
        {USAGE_METRICS.map((metric, metricIndex) => (
          <g key={metric}>
            <path d={areaPath(percents.map((row, index) => ({ x: x(index), y: y(row[metricIndex]) })), baseline)} fill={`url(#usage-area-${metric})`} />
            <path
              d={smoothPath(percents.map((row, index) => ({ x: x(index), y: y(row[metricIndex]) })))}
              fill="none"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              stroke={USAGE_STYLE[metric].stroke}
              strokeDasharray={USAGE_STYLE[metric].dash}
            />
            {history.map((day, index) => (
              <circle key={day.date} cx={x(index)} cy={y(percents[index][metricIndex])} r="3" fill={USAGE_STYLE[metric].stroke}>
                <title>{`${USAGE_LABELS[metric]} · ${day.date} : ${group.format(day[metric])} (${percents[index][metricIndex]} %)`}</title>
              </circle>
            ))}
          </g>
        ))}
        {pills.map((pill) => (
          <g key={pill.id} className="curve-pill" style={{ '--pill': USAGE_STYLE[pill.id as keyof typeof USAGE_STYLE].stroke } as CSSProperties} aria-hidden="true">
            <rect x={pill.x} y={pill.y} width={pill.width} height={PILL_HEIGHT} rx={PILL_HEIGHT / 2} />
            <text x={pill.x + pill.width / 2} y={pill.y + PILL_HEIGHT / 2 + 4} textAnchor="middle">{pill.text}</text>
          </g>
        ))}
      </svg>
      <ul className="usage-chart-legend">
        {USAGE_METRICS.map((metric) => (
          <li key={metric}>
            <svg width="28" height="8" aria-hidden="true">
              <line x1="0" x2="28" y1="4" y2="4" strokeWidth="2" stroke={USAGE_STYLE[metric].stroke} strokeDasharray={USAGE_STYLE[metric].dash} />
            </svg>
            {USAGE_LABELS[metric]}
          </li>
        ))}
      </ul>
      <details className="usage-chart-table">
        <summary>Voir les valeurs jour par jour</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Jour (UTC)</th>
              {USAGE_METRICS.map((metric) => <th scope="col" key={metric}>{USAGE_LABELS[metric]}</th>)}
            </tr>
          </thead>
          <tbody>
            {history.map((day, index) => (
              <tr key={day.date}>
                <th scope="row">{day.date}</th>
                {USAGE_METRICS.map((metric, metricIndex) => (
                  <td key={metric}>{group.format(day[metric])} ({percents[index][metricIndex]} %)</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
