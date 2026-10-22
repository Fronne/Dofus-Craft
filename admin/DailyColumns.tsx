const WIDTH = 600;
const HEIGHT = 140;
const PAD = { left: 40, right: 8, top: 8, bottom: 20 };
const group = new Intl.NumberFormat('fr-FR');

export type Column = { date: string; parts: Record<string, number> };
export type Series = { id: string; label: string };

// Four fills told apart by pattern as well as colour, so the chart never relies on colour alone (FR-006).
const FILLS = [
  { color: 'var(--accent-bright)', pattern: null },
  { color: 'var(--warning)', pattern: 'diagonal' },
  { color: 'var(--danger)', pattern: 'dots' },
  { color: 'var(--success)', pattern: 'horizontal' },
] as const;

const dayLabel = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

// specs/070-admin-dashboard-graphiques (research.md R5): one column per day, stacked by series. A day with no value is a
// column of 0; days after `columns` (the days to come) are simply not drawn. The values are also in a table.
export function DailyColumns({ columns, series, caption }: { columns: Column[]; series: Series[]; caption: string }) {
  const totals = columns.map((column) => series.reduce((sum, item) => sum + (column.parts[item.id] ?? 0), 0));
  const top = Math.max(1, ...totals);
  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const slot = plotWidth / Math.max(1, columns.length);
  const barWidth = Math.max(2, slot * 0.7);
  const patternId = (index: number) => `daily-pattern-${caption.replace(/\W+/g, '-')}-${index}`;

  return (
    <figure className="chart-figure daily-columns">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={caption}>
        <defs>
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
        <text x={PAD.left - 4} y={PAD.top + 8} textAnchor="end" className="usage-chart-axis">{group.format(top)}</text>
        <text x={PAD.left - 4} y={PAD.top + plotHeight + 3} textAnchor="end" className="usage-chart-axis">0</text>
        {columns.length > 0 && <text x={PAD.left} y={HEIGHT - 4} className="usage-chart-axis">{dayLabel(columns[0].date)}</text>}
        {columns.length > 1 && (
          <text x={WIDTH - PAD.right} y={HEIGHT - 4} textAnchor="end" className="usage-chart-axis">{dayLabel(columns[columns.length - 1].date)}</text>
        )}
        {columns.map((column, columnIndex) => {
          let y = PAD.top + plotHeight;
          const x = PAD.left + columnIndex * slot + (slot - barWidth) / 2;
          return (
            <g key={column.date}>
              <title>{`${column.date} : ${series.map((item) => `${item.label} ${group.format(column.parts[item.id] ?? 0)}`).join(', ')}`}</title>
              {series.map((item, seriesIndex) => {
                const value = column.parts[item.id] ?? 0;
                const height = (value / top) * plotHeight;
                y -= height;
                if (height <= 0) return null;
                const fill = FILLS[seriesIndex % FILLS.length];
                return (
                  <rect
                    key={item.id}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={height}
                    fill={fill.pattern === null ? fill.color : `url(#${patternId(seriesIndex % FILLS.length)})`}
                    stroke={fill.color}
                    strokeWidth="1"
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
      {series.length > 1 && (
        <ul className="chart-legend">
          {series.map((item, index) => (
            <li key={item.id}>
              <svg width="14" height="14" aria-hidden="true">
                <rect
                  width="14"
                  height="14"
                  fill={FILLS[index % FILLS.length].pattern === null ? FILLS[index % FILLS.length].color : `url(#${patternId(index % FILLS.length)})`}
                  stroke={FILLS[index % FILLS.length].color}
                />
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
            {columns.map((column) => (
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
