import { USAGE_LABELS, USAGE_LIMITS, USAGE_METRICS, usagePercent, type UsageDay, type UsageMetric } from '../src/domain/cloudflare-usage';

const WIDTH = 600;
const HEIGHT = 160;
const PAD = { left: 36, right: 8, top: 8, bottom: 20 };

// Distinct by dash pattern as well as by colour, so the chart never relies on colour alone.
const STYLE: Record<UsageMetric, { stroke: string; dash?: string }> = {
  workersRequests: { stroke: 'var(--accent-bright)' },
  d1RowsRead: { stroke: 'var(--warning)', dash: '6 3' },
  d1RowsWritten: { stroke: 'var(--danger)', dash: '2 3' },
};

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

  return (
    <figure className="usage-chart">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`Consommation des ${history.length} derniers jours, en pourcentage de la limite quotidienne`}>
        <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(100)} y2={y(100)} className="usage-chart-limit" />
        <text x={PAD.left - 4} y={y(100) + 3} textAnchor="end" className="usage-chart-axis">100 %</text>
        <text x={PAD.left - 4} y={y(0) + 3} textAnchor="end" className="usage-chart-axis">0</text>
        <text x={PAD.left} y={HEIGHT - 4} className="usage-chart-axis">{dayLabel(history[0].date)}</text>
        <text x={WIDTH - PAD.right} y={HEIGHT - 4} textAnchor="end" className="usage-chart-axis">{dayLabel(history[history.length - 1].date)}</text>
        {USAGE_METRICS.map((metric, metricIndex) => (
          <g key={metric}>
            <polyline
              fill="none"
              strokeWidth="2"
              stroke={STYLE[metric].stroke}
              strokeDasharray={STYLE[metric].dash}
              points={percents.map((row, index) => `${x(index)},${y(row[metricIndex])}`).join(' ')}
            />
            {history.map((day, index) => (
              <circle key={day.date} cx={x(index)} cy={y(percents[index][metricIndex])} r="3" fill={STYLE[metric].stroke}>
                <title>{`${USAGE_LABELS[metric]} · ${day.date} : ${group.format(day[metric])} (${percents[index][metricIndex]} %)`}</title>
              </circle>
            ))}
          </g>
        ))}
      </svg>
      <ul className="usage-chart-legend">
        {USAGE_METRICS.map((metric) => (
          <li key={metric}>
            <svg width="28" height="8" aria-hidden="true">
              <line x1="0" x2="28" y1="4" y2="4" strokeWidth="2" stroke={STYLE[metric].stroke} strokeDasharray={STYLE[metric].dash} />
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
