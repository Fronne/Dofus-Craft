import type { BrisageOption } from '../../domain/brisage';
import { Kamas } from '../prices/PricesPage';
import type { BrisageAnalysis } from './brisageAnalysis';

/** The foot of the table: total of the runes and total of the item (price deducted), without focus and with the best focus. */
export function BrisageTotals({ normal, bestFocus, noCoefficient, costKnown, cost }: {
  normal: BrisageAnalysis['normal'];
  bestFocus: BrisageAnalysis['bestFocus'];
  noCoefficient: boolean;
  costKnown: boolean;
  cost: number;
}) {
  /** Gain of the item for an option; without a coefficient, the item price is only deducted when known. */
  const gainOf = (option: BrisageOption | undefined): number | undefined => {
    if (!option) return undefined;
    if (!noCoefficient) return option.gainKamas;
    if (option.missingRuneIds.length > 0) return undefined;
    return costKnown ? option.valueKamas - cost : option.valueKamas;
  };
  /** Value of the runes of an option, without the price of the item; unknown while a rune has no price. */
  const runesTotal = (option: BrisageOption | undefined): number | undefined => (
    option && option.missingRuneIds.length === 0 ? option.valueKamas : undefined
  );
  /** Green for a positive total, red for a negative one; nothing while the total is unknown or zero. */
  const totalTone = (amount: number | undefined) => (
    amount === undefined || Math.round(amount) === 0 ? undefined : amount > 0 ? 'brisage-total-gain' : 'brisage-total-loss'
  );
  return (
    <>
      {costKnown && (
        <tr role="row">
          <th scope="row" role="rowheader" colSpan={3}>Total des runes</th>
          <td />
          <td role="cell" data-label="Sans focus : total des runes" className={totalTone(runesTotal(normal))}>{runesTotal(normal) !== undefined ? <Kamas value={Math.round(runesTotal(normal)!)} /> : '—'}</td>
          <td />
          <td role="cell" data-label="Meilleur focus : total des runes" className={totalTone(runesTotal(bestFocus))}>{runesTotal(bestFocus) !== undefined ? <Kamas value={Math.round(runesTotal(bestFocus)!)} /> : '—'}</td>
        </tr>
      )}
      <tr role="row">
        <th scope="row" role="rowheader" colSpan={3}>{noCoefficient && !costKnown ? 'Total des runes' : "Total de l'objet, prix déduit"}</th>
        <td />
        <td role="cell" data-label="Sans focus : total" className={totalTone(gainOf(normal))}>{gainOf(normal) !== undefined ? <Kamas value={Math.round(gainOf(normal)!)} signed={!noCoefficient || costKnown} /> : '—'}</td>
        <td />
        <td role="cell" data-label="Meilleur focus : total" className={totalTone(gainOf(bestFocus))}>{gainOf(bestFocus) !== undefined ? <Kamas value={Math.round(gainOf(bestFocus)!)} signed={!noCoefficient || costKnown} /> : '—'}</td>
      </tr>
    </>
  );
}
