const WIDTH = 600;
const HEIGHT = 170;
const PAD = { left: 40, right: 8, top: 22, bottom: 24 };
const MAX_BAR = 30;
const MAX_LABELS = 8;
const group = new Intl.NumberFormat('fr-FR');

export type Column = { date: string; parts: Record<string, number> };
export type Series = { id: string; label: string };

// Four fills told apart by pattern as well as colour, so the chart never relies on colour alone (FR-006). The first one
// is a gradient of the accent; the others keep their hatching.
const FILLS = [
  { color: 'var(--accent-bright)', pattern: null },
  { color: 'var(--warning)', pattern: 'diagonal' },
  { color: 'var(--danger)', pattern: 'dots' },
  { color: 'var(--success)', pattern: 'horizontal' },
] as const;

const dayLabel = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

// specs/070-admin-dashboard-graphiques (research.md R5): one column per day, stacked by series. The days without any value
// are left out (no column, no row in the table): nothing to read there. The value of a day shows when it is hovered or
// focused, and the best day is always written. The values are also in a table.
export function DailyColumns({ columns, series, caption }: { columns: Column[]; series: Series[]; caption: string }) {
  const days = columns
    .map((column) => ({ column, total: series.reduce((sum, item) => sum + (column.parts[item.id] ?? 0), 0) }))
    .filter((day) => day.total > 0);
  const top = Math.max(1, ...days.map((day) => day.total));
  const best = days.length > 1 ? days.reduce((winner, day) => (day.total > winner.total ? day : winner)) : undefined;
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const baseline = PAD.top + plotHeight;
  const slot = plotWidth / Math.max(1, days.length);
  const barWidth = Math.min(MAX_BAR, Math.max(4, slot * 0.68));
  const labelEvery = Math.ceil(days.length / MAX_LABELS);
  const id = caption.replace(/\W+/g, '-');
  const patternId = (index: number) => `daily-pattern-${id}-${index}`;
  const gradientId = `daily-gradient-${id}`;
  const gridValues = [0, top / 2, top];

  const paint = (seriesIndex: number) => {
    const fill = FILLS[seriesIndex % FILLS.length];
    return fill.pattern === null ? `url(#${gradientId})` : `url(#${patternId(seriesIndex % FILLS.length)})`;
  };

  return (
    <figure className="chart-figure daily-columns">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={caption}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--accent-bright)' }} />
            <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--accent) 58%, black)' }} />
          </linearGradient>
          {FILLS.map((fill, index) =>
            fill.pattern === null ? null : (
              <pattern key={fill.pattern} id={patternId(index)} width="6" height="6" patternUnits="userSpaceOnUse">
                <rect width="6" height="6" fill={fill.color} opacity="0.35" />
                {fill.pattern === 'diagonal' && <path d="M0 6 L6 0" stroke={fill.color} strokeWidth="1.5" />}
                {fill.pattern === 'dots' && <circle cx="3" cy="3" r="1.4" fill={fill.color} />}
                {fill.pattern === 'horizontal' && <path d="M0 3 H6" stroke={fill.color} strokeWidth="1.5" />}
              </pattern>
            ),
          )}
        </defs>
        {gridValues.map((value, index) => {
          const y = baseline - (value / top) * plotHeight;
          return (
            <g key={index}>
              <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y} y2={y} className="chart-grid" />
              <text x={PAD.left - 6} y={y + 3} textAnchor="end" className="usage-chart-axis">{group.format(Math.round(value))}</text>
            </g>
          );
        })}
        {days.map(({ column, total }, dayIndex) => {
          let y = baseline;
          const x = PAD.left + dayIndex * slot + (slot - barWidth) / 2;
          const centre = x + barWidth / 2;
          const isBest = best?.column.date === column.date;
          return (
            <g key={column.date} className="daily-column" tabIndex={0}>
              <title>{`${column.date} : ${series.map((item) => `${item.label} ${group.format(column.parts[item.id] ?? 0)}`).join(', ')}`}</title>
              <rect x={x - 3} y={PAD.top - 6} width={barWidth + 6} height={plotHeight + 6} className="daily-hit" />
              {series.map((item, seriesIndex) => {
                const value = column.parts[item.id] ?? 0;
                const height = (value / top) * plotHeight;
                if (height <= 0) return null;
                y -= height;
                const color = FILLS[seriesIndex % FILLS.length].color;
                return (
                  <rect
                    key={item.id}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={height}
                    rx={Math.min(5, barWidth / 3, height / 2)}
                    fill={paint(seriesIndex)}
                    stroke={seriesIndex === 0 ? 'none' : color}
                    strokeWidth="1"
                    className="daily-bar"
                  />
                );
              })}
              <text x={centre} y={y - 5} textAnchor="middle" className={`daily-value${isBest ? ' daily-value--best' : ''}`}>{group.format(total)}</text>
              {dayIndex % labelEvery === 0 && (
                <text x={centre} y={HEIGHT - 6} textAnchor="middle" className="usage-chart-axis">{dayLabel(column.date)}</text>
              )}
            </g>
          );
        })}
      </svg>
      {series.length > 1 && (
        <ul className="chart-legend">
          {series.map((item, index) => (
            <li key={item.id}>
              <svg width="14" height="14" aria-hidden="true">
                <rect width="14" height="14" rx="3" fill={paint(index)} stroke={FILLS[index % FILLS.length].color} />
              </svg>
              {item.label}
            </li>
          ))}
        </ul>
      )}
      <details className="chart-table">
        <summary>Voir les valeurs jour par jour</summary>
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">Jour (UTC)</th>
              {series.map((item) => <th scope="col" key={item.id}>{item.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {days.map(({ column }) => (
              <tr key={column.date}>
                <th scope="row">{column.date}</th>
                {series.map((item) => <td key={item.id}>{group.format(column.parts[item.id] ?? 0)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
