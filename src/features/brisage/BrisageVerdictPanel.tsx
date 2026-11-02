import { Icon } from '../../components/Icon';
import { Kamas } from '../prices/PricesPage';
import type { BrisageAnalysis, BrisageVerdict } from './brisageAnalysis';
import { number, shortRune } from './brisageHelpers';
import { BestExo } from './BestExo';

/** The verdict of the analysis (profitable or not, with or without focus), its thresholds and the best exo. */
export function BrisageVerdictPanel({ verdict, ok, best, normal, bestFocus, focusWins, offeredExo, onAddExo }: {
  verdict: BrisageVerdict;
  ok: NonNullable<BrisageAnalysis['ok']>;
  best: BrisageAnalysis['best'];
  normal: BrisageAnalysis['normal'];
  bestFocus: BrisageAnalysis['bestFocus'];
  focusWins: boolean;
  offeredExo: BrisageAnalysis['offeredExo'];
  onAddExo: () => void;
}) {
  return (
    <section className="brisage-part market-price-panel item-verdict-panel" aria-live="polite">
      <div className="market-price-summary">
        <div className={`verdict brisage-verdict verdict--${verdict.tone === 'good' ? 'craft' : verdict.tone === 'bad' ? 'bad' : 'insufficient-data'}`}>
          <div className="verdict-head">
            <span className="verdict-icon" aria-hidden="true"><Icon name={verdict.tone === 'good' ? 'check' : 'info'} size={22} /></span>
            <div className="verdict-text">
              <span className="visually-hidden">Verdict</span>
              <p className="verdict-title">{verdict.title}</p>
              {focusWins && normal?.gainKamas !== undefined && (
                <p className="verdict-subtitle">Contre <Kamas value={Math.round(normal.gainKamas)} signed /> sans focus</p>
              )}
              {verdict.hint && <p className="verdict-subtitle">{verdict.hint}</p>}
            </div>
            {best && (
              <div className="brisage-verdict-gain">
                <Kamas value={Math.round(best.gainKamas!)} signed />
              </div>
            )}
          </div>
          {(ok.thresholdCoefficient !== undefined || ok.focusThresholdCoefficient !== undefined) && (
            <dl className="brisage-facts">
              {ok.thresholdCoefficient !== undefined && (
                <div><dt>Sans focus, rentable jusqu'à</dt><dd>{number.format(ok.thresholdCoefficient)} %</dd></div>
              )}
              {ok.focusThresholdCoefficient !== undefined && bestFocus && (
                <div><dt>Focus {shortRune(bestFocus)}, rentable jusqu'à</dt><dd>{number.format(ok.focusThresholdCoefficient)} %</dd></div>
              )}
              {ok.thresholdCoefficient !== undefined && (
                <div><dt>Brisages possibles avant ce seuil</dt><dd>{ok.itemsCount}</dd></div>
              )}
            </dl>
          )}
          {offeredExo && <BestExo exo={offeredExo} onAdd={onAddExo} />}
        </div>
      </div>
    </section>
  );
}
