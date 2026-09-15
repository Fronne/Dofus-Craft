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
  buy: 'neutral',
  equal: 'neutral',
  'insufficient-data': 'warning',
};

const badgeIcons: Record<Recommendation, IconName> = {
  craft: 'trending-up',
  buy: 'trending-down',
  equal: 'info',
  'insufficient-data': 'info',
};

export function ComparisonResult({ result }: { result?: Comparison }) {
  if (!result) return null;

  return (
    <section className="result">
      <p className={`badge badge-${badgeVariants[result.recommendation]}`}>
        <Icon name={badgeIcons[result.recommendation]} size={16} />
        {labels[result.recommendation]}
      </p>
      <p>
        Coût connu : <strong>{formatKamas(result.knownCraftCostKamas)}</strong>
        {result.craftCostStatus === 'partial' && ' (partiel)'}
      </p>
      {result.missingResourceIds.length > 0 && (
        <p className="warning">
          Prix manquants : {result.missingResourceIds.length}. Ajoutez-les pour une recommandation
          définitive.
        </p>
      )}
      {result.differenceKamas !== undefined && (
        <>
          <p>
            Économie : <strong>{formatKamas(result.differenceKamas)}</strong>
          </p>
          <p>
            Pourcentage : <strong>{formatPercent(result.percentage)}</strong>
            {result.percentageBase &&
              ` (par rapport au ${result.percentageBase === 'market-price' ? 'prix HDV' : 'coût de craft'})`}
          </p>
        </>
      )}
    </section>
  );
}
