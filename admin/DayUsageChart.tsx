import {
  USAGE_LABELS,
  USAGE_METRICS,
  crossingText,
  thresholdCrossings,
  type CumulativeHour,
} from '../src/domain/cloudflare-usage';
import { USAGE_STYLE } from './usage-style';

const WIDTH = 600;
const HEIGHT = 160;
const PAD = { left: 36, right: 8, top: 8, bottom: 20 };
const group = new Intl.NumberFormat('fr-FR');
const timeFormatter = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });

// specs/070-admin-dashboard-graphiques (US1): the running total of the UTC day so far, one point per hour, for the three
// metrics as a percentage of their daily limit. The day is the limit's own period, so the curve goes from 00:00 UTC to
// now and starts over at midnight. The hours where 80 % and 100 % were reached are ringed on the curve AND written out.
export function DayUsageChart({ hours, readAt }: { hours: CumulativeHour[]; readAt: string }) {
  if (hours.length === 0) return null;
  const crossings = thresholdCrossings(hours);
  const top = Math.max(100, ...hours.flatMap((entry) => USAGE_METRICS.map((metric) => entry.percent[metric])));
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  // The axis is the whole day (0 h to 23 h), so the curve visibly grows towards the evening.
  const x = (hour: number) => PAD.left + (hour / 23) * plotWidth;
  const y = (percent: number) => PAD.top + plotHeight - (percent / top) * plotHeight;
  const last = hours[hours.length - 1];

  return (
    <figure className="chart-figure day-usage-chart">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Consommation cumulée de la journée UTC en cours, en pourcentage de la limite quotidienne">
        <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(100)} y2={y(100)} className="usage-chart-limit" />
        <text x={PAD.left - 4} y={y(100) + 3} textAnchor="end" className="usage-chart-axis">100 %</text>
        <text x={PAD.left - 4} y={y(0) + 3} textAnchor="end" className="usage-chart-axis">0</text>
        <text x={PAD.left} y={HEIGHT - 4} className="usage-chart-axis">0 h</text>
        <text x={WIDTH - PAD.right} y={HEIGHT - 4} textAnchor="end" className="usage-chart-axis">23 h UTC</text>
        {USAGE_METRICS.map((metric) => (
          <g key={metric}>
            <polyline
              fill="none"
              strokeWidth="2"
              stroke={USAGE_STYLE[metric].stroke}
              strokeDasharray={USAGE_STYLE[metric].dash}
              points={hours.map((entry) => `${x(entry.hour)},${y(entry.percent[metric])}`).join(' ')}
            />
            {hours.map((entry) => (
              <circle
                key={entry.hour}
                cx={x(entry.hour)}
                cy={y(entry.percent[metric])}
                r={entry.partial ? 4 : 2.5}
                fill={entry.partial ? 'var(--inner-bg)' : USAGE_STYLE[metric].stroke}
                stroke={USAGE_STYLE[metric].stroke}
                strokeWidth="2"
              >
                <title>{`${USAGE_LABELS[metric]} · ${entry.hour} h UTC${entry.partial ? ' (heure en cours, partielle)' : ''} : ${group.format(entry.used[metric])} (${entry.percent[metric]} %)`}</title>
              </circle>
            ))}
          </g>
        ))}
        {crossings.map((crossing) => {
          const point = hours.find((entry) => entry.hour === crossing.hour)!;
          return (
            <circle
              key={`${crossing.metric}-${crossing.level}`}
              cx={x(crossing.hour)}
              cy={y(point.percent[crossing.metric])}
              r="7"
              fill="none"
              stroke={crossing.level === 'over' ? 'var(--danger)' : 'var(--warning)'}
              strokeWidth="2"
            >
              <title>{crossingText(crossing)}</title>
            </circle>
          );
        })}
      </svg>
      <ul className="chart-legend">
        {USAGE_METRICS.map((metric) => (
          <li key={metric}>
            <svg width="28" height="8" aria-hidden="true">
              <line x1="0" x2="28" y1="4" y2="4" strokeWidth="2" stroke={USAGE_STYLE[metric].stroke} strokeDasharray={USAGE_STYLE[metric].dash} />
            </svg>
            {USAGE_LABELS[metric]}
          </li>
        ))}
      </ul>
      {crossings.length === 0 ? (
        <p className="dashboard-visual-note">Aucune limite n'a atteint 80 % aujourd'hui.</p>
      ) : (
        <ul className="chart-notes">
          {crossings.map((crossing) => <li key={`${crossing.metric}-${crossing.level}`}>{crossingText(crossing)}</li>)}
        </ul>
      )}
      <p className="dashboard-visual-note">
        Jour UTC en cours, lu à {timeFormatter.format(new Date(readAt))} UTC : l'heure de {last.hour} h est partielle (cercle creux).
      </p>
      <details className="chart-table">
        <summary>Voir les valeurs heure par heure</summary>
        <table>
          <caption>Consommation cumulée de la journée UTC en cours</caption>
          <thead>
            <tr>
              <th scope="col">Heure (UTC)</th>
              {USAGE_METRICS.map((metric) => <th scope="col" key={metric}>{USAGE_LABELS[metric]}</th>)}
            </tr>
          </thead>
          <tbody>
            {hours.map((entry) => (
              <tr key={entry.hour}>
                <th scope="row">{entry.hour} h{entry.partial ? ' (partielle)' : ''}</th>
                {USAGE_METRICS.map((metric) => <td key={metric}>{group.format(entry.used[metric])} ({entry.percent[metric]} %)</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
