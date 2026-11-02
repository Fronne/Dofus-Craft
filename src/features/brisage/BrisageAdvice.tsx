import { Icon } from '../../components/Icon';
import type { BrisageAnalysis } from './brisageAnalysis';
import { number } from './brisageHelpers';
import { BestExo } from './BestExo';

/** The advice shown while the coefficient is unknown (specs/063). */
export function BrisageAdvice({ adviceKnown, adviceTitle, adviceHint, adviceBreakEven, offeredExo, onAddExo }: {
  adviceKnown: boolean;
  adviceTitle: string;
  adviceHint: string;
  adviceBreakEven: number | undefined;
  offeredExo: BrisageAnalysis['offeredExo'];
  onAddExo: () => void;
}) {
  return (
    <section className="brisage-part market-price-panel item-verdict-panel" aria-live="polite">
      <div className="market-price-summary">
        <div className={`verdict brisage-verdict verdict--${adviceKnown ? 'craft' : 'insufficient-data'}`}>
          <div className="verdict-head">
            <span className="verdict-icon" aria-hidden="true"><Icon name={adviceKnown ? 'check' : 'info'} size={22} /></span>
            <div className="verdict-text">
              <span className="brisage-verdict-label">Conseil</span>
              <p className="verdict-title">{adviceTitle}</p>
              <p className="verdict-subtitle">{adviceHint}</p>
              <p className="verdict-subtitle">Coefficient inconnu : indiquez-le pour un verdict précis.</p>
            </div>
          </div>
          {adviceBreakEven !== undefined && (
            <dl className="brisage-facts">
              <div><dt>Rentable tant que le coefficient reste au-dessus de</dt><dd>{number.format(adviceBreakEven)} %</dd></div>
            </dl>
          )}
          {offeredExo && <BestExo exo={offeredExo} onAdd={onAddExo} />}
        </div>
      </div>
    </section>
  );
}
