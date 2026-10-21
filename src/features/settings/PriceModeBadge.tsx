import { Icon } from '../../components/Icon';
import { priceModeCopy } from '../../domain/price-modes';
import type { PriceMode } from '../../domain/price-modes';

// Reminder at the top of the pages that show prices: which mode the figures below come from.
export function PriceModeBadge({ priceMode }: { priceMode: PriceMode }) {
  return (
    <p className={`price-mode-badge price-mode-badge--${priceMode}`}>
      <Icon name={priceMode === 'community' ? 'users' : 'user'} size={14} />
      <span>{priceModeCopy[priceMode].badge}</span>
    </p>
  );
}
