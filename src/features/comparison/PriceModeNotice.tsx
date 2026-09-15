import type { PriceMode } from '../../domain/price-modes';

export function PriceModeNotice({ priceMode }: { priceMode: PriceMode }) {
  if (priceMode !== 'community') return null;

  return (
    <div role="status" className="price-mode-notice">
      <p>
        La consultation et la contribution de prix communautaires ne sont pas encore disponibles.
        Vos prix personnels restent utilisés normalement en attendant.
      </p>
    </div>
  );
}
