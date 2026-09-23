import { describe, expect, it } from 'vitest';
import { resourcePricesFor } from '../../src/persistence/resource-prices-for-mode';
import { prices } from '../../src/persistence/indexeddb-resource-price-repository';
import { communityModePrices } from '../../src/persistence/indexeddb-community-mode-price-repository';

// Recherche, Épinglés and Prix all go through this, so they always show the same carnet.
describe('resourcePricesFor (specs/003-community-price-mode FR-005)', () => {
  it('uses the personal carnet in Mode personnel', () => {
    expect(resourcePricesFor('personal')).toBe(prices);
  });

  it('uses the community-mode carnet in Mode communautaire', () => {
    expect(resourcePricesFor('community')).toBe(communityModePrices);
  });
});
