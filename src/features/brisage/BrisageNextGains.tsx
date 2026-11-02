import { displayedCoefficient } from '../../domain/brisage';
import { Kamas } from '../prices/PricesPage';
import type { BrisageAnalysis } from './brisageAnalysis';

/** The compact line of side figures: what the next breaks would bring as the coefficient goes down. */
export function BrisageNextGains({ nextGains }: { nextGains: BrisageAnalysis['nextGains'] }) {
  return (
    <section className="brisage-part brisage-footline" aria-label="Informations annexes">
      <section className="brisage-gains-layout" aria-labelledby="brisage-gains-title">
        <h2 id="brisage-gains-title" className="visually-hidden">Gain selon le coefficient</h2>
        <div className="brisage-gains-next">
          <span className="brisage-gain-label">Après 1, 2, 3 brisages (sans focus, estimation)</span>
          <ul className="brisage-gains">
            {nextGains.map((point, index) => (
              <li key={index}>
                <span className="brisage-gain-label">à {displayedCoefficient(point.coefficient)} %</span>
                <span className={`brisage-gain-value${point.gain < -0.5 ? ' is-loss' : ''}`}>
                  <Kamas value={Math.round(point.gain)} signed />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </section>
  );
}
