import type { Comparison, Recommendation } from '../../domain/types';
import { formatKamas, formatPercent } from '../../domain/kamas';
import { Icon } from '../../components/Icon';
import type { IconName } from '../../components/Icon';

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

export function SavingsNote({ result }: { result: Comparison }) {
  if (result.differenceKamas === undefined || result.differenceKamas <= 0) return null;
  return result.recommendation === 'craft' ? (
    <p>
      Fabriquer coûte
      {result.percentage !== undefined && <> <strong>{formatPercent(result.percentage)} moins cher</strong></>}
      {' '}qu’acheter à l’HDV, soit une économie de{' '}
      <strong>{formatKamas(result.differenceKamas)}</strong>.
    </p>
  ) : (
    <p>
      Acheter à l’HDV coûte
      {result.percentage !== undefined && <> <strong>{formatPercent(result.percentage)} moins cher</strong></>}
      {' '}que fabriquer, soit une économie de{' '}
      <strong>{formatKamas(result.differenceKamas)}</strong>.
    </p>
  );
}
