const group = new Intl.NumberFormat('fr-FR');

export type Bar = { label: string; value: number; note?: string };

const MAX_LABEL = 22;
const truncate = (label: string) => (label.length > MAX_LABEL ? `${label.slice(0, MAX_LABEL - 1)}…` : label);

// The bars beyond `maxItems` are folded into one « Autres (N) » bar whose value is their exact sum.
function foldBars(bars: Bar[], maxItems: number): Bar[] {
  if (bars.length <= maxItems) return bars;
  const rest = bars.slice(maxItems);
  return [...bars.slice(0, maxItems), { label: `Autres (${rest.length})`, value: rest.reduce((sum, bar) => sum + bar.value, 0) }];
}

// specs/070-admin-dashboard-graphiques (research.md R5): horizontal bars, the exact value written next to each bar
// (never colour alone), and the same values in a table for the keyboard and screen readers.
export function BarList({ bars, maxItems = 8, caption }: { bars: Bar[]; maxItems?: number; caption: string }) {
  const shown = foldBars(bars, maxItems);
  const top = Math.max(1, ...shown.map((bar) => bar.value));
  return (
    <figure className="chart-figure bar-list">
      <ul className="bar-list-rows" aria-label={caption}>
        {shown.map((bar) => (
          <li key={bar.label} className="bar-list-row" title={`${bar.label} : ${group.format(bar.value)}${bar.note ? ` (${bar.note})` : ''}`}>
            <span className="bar-list-label">
              {truncate(bar.label)}
              {bar.note && <small> · {bar.note}</small>}
            </span>
            <span className="bar-list-track" aria-hidden="true">
              <span className="bar-list-fill" style={{ width: `${(bar.value / top) * 100}%` }} />
            </span>
            <span className="bar-list-value">{group.format(bar.value)}</span>
          </li>
        ))}
      </ul>
      <details className="chart-table">
        <summary>Voir les valeurs</summary>
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">Libellé</th>
              <th scope="col">Valeur</th>
              <th scope="col">Remarque</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((bar) => (
              <tr key={bar.label}>
                <th scope="row">{bar.label}</th>
                <td>{group.format(bar.value)}</td>
                <td>{bar.note ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
