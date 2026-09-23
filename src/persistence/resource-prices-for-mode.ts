import type { PriceMode } from '../domain/price-modes';
import type { ResourcePriceRepository } from './resource-price-repository';
import { prices } from './indexeddb-resource-price-repository';
import { communityModePrices } from './indexeddb-community-mode-price-repository';

// specs/003-community-price-mode FR-005: the resource-price carnet a page reads and writes follows
// the active price mode — the personal carnet in Mode personnel, the physically separate
// community-mode carnet in Mode communautaire, never a mix of both. Shared by every page that
// shows resource prices (Recherche, Épinglés, Prix) so they always agree on the same values.
export function resourcePricesFor(priceMode: PriceMode): ResourcePriceRepository {
  return priceMode === 'community' ? communityModePrices : prices;
}
