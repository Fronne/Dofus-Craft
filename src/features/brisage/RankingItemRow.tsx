import type { KeyboardEvent } from 'react';
import type { RankingRow } from '../../domain/brisage-ranking';
import { Kamas } from '../prices/PricesPage';
import { number as percent } from './brisageHelpers';
import { Age, BestChoice, ExoCell, GainCell, ThresholdCell } from './RankingCells';

/** One item of the ranking table; a click or Enter on the row opens the item page. */
export function RankingItemRow({ row, exosPending, onOpen }: {
  row: RankingRow;
  exosPending: boolean;
  onOpen: (row: RankingRow) => void;
}) {
  const exo = row.exo;
  const onRowKey = (event: KeyboardEvent<HTMLTableRowElement>) => {
    if (event.key === 'Enter' && event.target === event.currentTarget) onOpen(row);
  };
  return (
    <tr className="ranking-row" tabIndex={0} onClick={() => onOpen(row)} onKeyDown={onRowKey}>
      <th scope="row" data-label="Objet">
        <span className="ranking-item">
          {row.imageUrl ? <img src={row.imageUrl} alt="" loading="lazy" width="32" height="32" /> : <span className="resource-image-fallback" aria-hidden="true">{row.name.slice(0, 1)}</span>}
          <button type="button" className="ranking-open">{row.name}</button>
        </span>
      </th>
      <td data-label="Niveau">{row.level}</td>
      <td data-label="Prix">
        {row.priceKamas !== undefined
          ? <><Kamas value={row.priceKamas} />{' '}<Age date={row.priceUpdatedAt} what="Prix de l'objet" /></>
          : <span className="fm-note">—</span>}
      </td>
      <td data-label="Meilleur choix"><BestChoice row={row} /></td>
      <td data-label="Gain">{row.group === 'known' ? <GainCell row={row} /> : <span className="fm-note">—</span>}</td>
      <td data-label="Coefficient">
        {row.group === 'known'
          ? <>{percent.format(row.coefficient!)} % <Age date={row.coefficientAt} what="Coefficient" /></>
          : <span className="ranking-unknown">coefficient inconnu</span>}
      </td>
      <td data-label="Seuil de coefficient"><ThresholdCell row={row} /></td>
      <td data-label="Gain avec exo"><ExoCell row={row} exo={exo} pending={exosPending} /></td>
    </tr>
  );
}
