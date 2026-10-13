import type { ReactNode } from 'react';
import type { Comparison, Recommendation } from '../../domain/types';
import { formatKamas, formatPercent } from '../../domain/kamas';
import { Icon } from '../../components/Icon';
import type { IconName } from '../../components/Icon';
import { useCountUp } from './useCountUp';

const labels: Record<Recommendation, string> = {
  craft: 'Fabriquer est plus rentable',
  buy: 'Acheter à l’HDV est plus rentable',
  equal: 'Les deux options sont équivalentes',
  'insufficient-data': 'Comparaison incomplète',
};

const badgeVariants: Record<Recommendation, 'success' | 'warning' | 'neutral'> = {
  craft: 'success',
  buy: 'success',
  equal: 'neutral',
  'insufficient-data': 'neutral',
};

const badgeIcons: Record<Recommendation, IconName> = {
  craft: 'trending-up',
  buy: 'trending-up',
  equal: 'info',
  'insufficient-data': 'info',
};

// Explains why the comparison is incomplete — otherwise "Comparaison incomplète" gives no clue
// whether it's the resource prices or the HDV price that's missing. Shown as plain text rather
// than a hover-only tooltip so it stays reachable on touch devices, not just with a mouse.
export function insufficientDataHint(result: Comparison): string | undefined {
  if (result.recommendation !== 'insufficient-data') return undefined;
  const reasons: string[] = [];
  if (result.missingResourceIds.length > 0) {
    const count = result.missingResourceIds.length;
    reasons.push(`${count} prix de ressource${count > 1 ? 's' : ''} manquant${count > 1 ? 's' : ''}`);
  }
  if (result.marketPriceKamas === undefined) {
    reasons.push('le prix HDV n’est pas renseigné');
  }
  return reasons.length ? `Comparaison incomplète : ${reasons.join(' et ')}.` : undefined;
}

export function RecommendationBadge({ recommendation, hint }: { recommendation: Recommendation; hint?: string }) {
  return (
    <div className="badge-with-hint">
      <p className={`badge badge-${badgeVariants[recommendation]}`}>
        <Icon name={badgeIcons[recommendation]} size={18} />
        {labels[recommendation]}
      </p>
      {hint && <p className="badge-hint">{hint}</p>}
    </div>
  );
}

const verdictTitles: Record<Recommendation, string> = {
  craft: 'Fabriquer',
  buy: 'Acheter à l’HDV',
  equal: 'Les deux se valent',
  'insufficient-data': 'Comparaison incomplète',
};

// A decided verdict shows a check, drawn in a diamond (specs/051-site-visual-refresh, FR-021).
const verdictIcons: Record<Recommendation, IconName> = {
  craft: 'check',
  buy: 'check',
  equal: 'info',
  'insufficient-data': 'info',
};

// One row of the comparison: its amount on the left — or, for the HDV price, the field where it's
// typed (`field`) — and a bar proportional to it on the right.
function VerdictBar({ label, value, max, partial, cheaper, field }: {
  label: string;
  value?: number;
  max: number;
  partial?: boolean;
  cheaper: boolean;
  field?: ReactNode;
}) {
  const width = value !== undefined && max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className={`verdict-bar${cheaper ? ' verdict-bar--cheaper' : ''}`}>
      {field ?? (
        <p className="verdict-bar-label">
          {/* The amount is its own box: on a wide screen it sits at the right of the bar. */}
          {label} : <span className="verdict-bar-amount">
            {value !== undefined ? <strong>{formatKamas(value)}</strong> : <span className="verdict-bar-empty">non renseigné</span>}
            {partial && ' (partiel)'}
          </span>
        </p>
      )}
      <span className="verdict-bar-track" aria-hidden="true">
        <span className="verdict-bar-fill" style={{ width: `${width}%` }} />
      </span>
    </div>
  );
}

// What the verdict saves, counted up when it appears and from one amount to the next after that.
function SavingsAmount({ kamas }: { kamas: number }) {
  return <strong>{formatKamas(useCountUp(kamas))}</strong>;
}

// specs/001 FR-010/FR-011/FR-016: the craft-or-buy verdict at a glance — the recommendation in large
// type with what it saves (kamas and percentage, with its point of comparison), then the craft cost
// and the HDV price as proportional bars, the cheaper one highlighted. An incomplete comparison
// (FR-012) says what's missing instead of recommending, and highlights neither bar.
// `marketPriceField`: the HDV price input, shown on the HDV row in place of its amount.
export function ComparisonVerdict({ result, marketPriceField }: { result: Comparison; marketPriceField?: ReactNode }) {
  const { recommendation } = result;
  const definitive = recommendation === 'craft' || recommendation === 'buy';
  const hint = insufficientDataHint(result)?.replace(/^Comparaison incomplète : /, '');
  const max = Math.max(result.knownCraftCostKamas, result.marketPriceKamas ?? 0);
  const subtitle = definitive
    ? 'est plus rentable'
    : recommendation === 'equal'
      ? 'Fabriquer ou acheter coûte pareil.'
      : hint && hint.charAt(0).toUpperCase() + hint.slice(1);
  return (
    <div className={`verdict verdict--${recommendation}`}>
      {/* Keyed by the recommendation: a verdict that changes comes in again (global.css). */}
      <div className="verdict-head" key={recommendation}>
        <span className="verdict-icon" aria-hidden="true"><Icon name={verdictIcons[recommendation]} size={22} /></span>
        <div className="verdict-text">
          <p className="verdict-title">{verdictTitles[recommendation]}</p>
          {subtitle && <p className="verdict-subtitle">{subtitle}</p>}
        </div>
        {definitive && result.differenceKamas !== undefined && result.differenceKamas > 0 && (
          <div className="verdict-savings">
            <SavingsAmount kamas={result.differenceKamas} />
            <span>
              d’économie
              {result.percentage !== undefined && (
                <> · {formatPercent(result.percentage)} moins cher {recommendation === 'craft' ? 'qu’à l’HDV' : 'que le craft'}</>
              )}
            </span>
          </div>
        )}
      </div>
      <div className="verdict-bars">
        <VerdictBar
          label="Coût de craft"
          value={result.knownCraftCostKamas}
          max={max}
          partial={result.craftCostStatus === 'partial'}
          cheaper={recommendation === 'craft'}
        />
        <VerdictBar
          label="Prix HDV"
          value={result.marketPriceKamas}
          max={max}
          cheaper={recommendation === 'buy'}
          field={marketPriceField}
        />
      </div>
    </div>
  );
}
