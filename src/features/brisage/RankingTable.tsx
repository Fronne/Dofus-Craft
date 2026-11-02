import type { RankingColumn, RankingRow, RankingView } from '../../domain/brisage-ranking';
import { RankingItemRow } from './RankingItemRow';

const COLUMNS: { column: RankingColumn | undefined; label: string }[] = [
  { column: 'name', label: 'Objet' },
  { column: 'level', label: 'Niveau' },
  { column: 'price', label: 'Prix' },
  { column: undefined, label: 'Meilleur choix' },
  { column: 'gain', label: 'Gain' },
  { column: undefined, label: 'Coefficient' },
  { column: 'threshold', label: 'Seuil de coefficient' },
  { column: 'exoGain', label: 'Gain avec exo' },
];

/** The ranking table: sortable header, then the items with a known coefficient and those without. */
export function RankingTable({ view, known, unknown, limit, exosPending, sortBy, openRow }: {
  view: RankingView;
  known: RankingRow[];
  unknown: RankingRow[];
  limit: number;
  exosPending: boolean;
  sortBy: (column: RankingColumn) => void;
  openRow: (row: RankingRow) => void;
}) {
  const groupRows = (title: string, id: string, list: RankingRow[], hint: string) => (list.length === 0 ? null : (
    <tbody key={id} aria-label={title}>
      <tr className="ranking-group"><th scope="colgroup" colSpan={COLUMNS.length}>{title} <span className="fm-note">({list.length}) — {hint}</span></th></tr>
      {list.slice(0, limit).map((row) => <RankingItemRow key={row.itemId} row={row} exosPending={exosPending} onOpen={openRow} />)}
    </tbody>
  ));

  const sortState = (column: RankingColumn | undefined) => (column !== undefined && view.sortColumn === column ? (view.sortDirection === 'asc' ? 'ascending' : 'descending') : 'none');

  return (
    <div className="brisage-table-wrap">
      <table className="brisage-table ranking-table" role="table">
        <caption className="visually-hidden">Objets à briser, classés par rentabilité estimée</caption>
        <thead>
          <tr role="row">
            {COLUMNS.map(({ column, label }) => (
              <th key={label} scope="col" aria-sort={column ? sortState(column) : undefined}>
                {column ? (
                  <button type="button" className="ranking-sort" onClick={() => sortBy(column)}>
                    {label}{view.sortColumn === column ? (view.sortDirection === 'asc' ? ' ▲' : ' ▼') : ''}
                  </button>
                ) : label}
              </th>
            ))}
          </tr>
        </thead>
        {groupRows('Coefficient connu', 'known', known, 'gain par objet, prix de l\'objet déduit')}
        {groupRows('Coefficient inconnu', 'unknown', unknown, 'classés par coefficient minimum requis')}
      </table>
    </div>
  );
}
