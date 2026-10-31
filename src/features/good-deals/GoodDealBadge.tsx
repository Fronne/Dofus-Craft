import { formatKamas } from '../../domain/kamas';
import type { DealVerdict } from '../../domain/good-deals';

// specs/078-bons-plans-hdv: the « Bon plan » badge of an announcement, with what a player needs to check it
// (constitution III): the saving, the price it is compared to and how many copies that comes from.
export function GoodDealBadge({ deal, compact = false }: { deal: DealVerdict; compact?: boolean }) {
  const explanation = [
    `Économie : ${formatKamas(deal.savingKamas)} (${deal.savingPercent} %)`,
    deal.referencePriceKamas === undefined ? undefined : `Prix attendu pour ce jet : ${formatKamas(deal.referencePriceKamas)}`,
    `Comparé à ${deal.neighbourCount} annonce${deal.neighbourCount > 1 ? 's' : ''} de jet proche${deal.hasExo ? ' avec le même exo' : ''}`,
    deal.unknownLines > 0 ? 'Jet partiellement lu : certaines lignes sont ignorées.' : undefined,
  ].filter(Boolean).join('. ');
  return (
    <span className={compact ? 'good-deal-badge good-deal-badge--tag' : 'good-deal-badge'} tabIndex={0} title={explanation} aria-label={`Bon plan. ${explanation}`}>
      {compact ? '' : 'Bon plan '}−{deal.savingPercent} %
      {deal.unknownLines > 0 && <span className="good-deal-badge-partial"> · jet partiel</span>}
    </span>
  );
}
