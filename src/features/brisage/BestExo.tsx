import type { bestExoFor } from '../../domain/brisage-ranking';
import { Kamas } from '../prices/PricesPage';
import { number } from './brisageHelpers';

/** The best exo to add, inside the verdict: its rune and what breaking the item with it brings. */
export function BestExo({ exo, onAdd }: { exo: NonNullable<ReturnType<typeof bestExoFor>>; onAdd: () => void }) {
  return (
    <div className="brisage-best-exo" aria-label="Meilleur exo à ajouter">
      <span className="brisage-verdict-label">Meilleur exo à ajouter</span>
      <div className="brisage-best-exo-head">
        <div className="brisage-best-exo-rune">
          {exo.runeImageUrl && <img src={exo.runeImageUrl} alt="" width="40" height="40" />}
          <div>
            <strong>{exo.runeName}</strong>
            {exo.improvementKamas !== undefined ? (
              <p className="verdict-subtitle"><Kamas value={Math.round(exo.improvementKamas)} signed /></p>
            ) : exo.thresholdCoefficient !== undefined && (
              <p className="verdict-subtitle">Rentable tant que le coefficient reste au-dessus de {number.format(exo.thresholdCoefficient)} %</p>
            )}
          </div>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onAdd}>+ Ajouter</button>
      </div>
    </div>
  );
}
