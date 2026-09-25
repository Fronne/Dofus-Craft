import { IDBFactory } from 'fake-indexeddb';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatKamas } from '../../src/domain/kamas';
import type { Recipe, Resource } from '../../src/domain/types';
import type { CommunityPriceLookup } from '../../src/services/community-price-api';

const n = (value: string) => value.replace(/\u202f/g, ' ');

// Same chain as tests/integration/intermediate-craft-costs.test.tsx (specs/015 quickstart.md).
const { DAGUES, DAGUES_RECIPE, PLANCHE, PEAU, getResourceRecipe, getCommunityPrice } = vi.hoisted(() => {
  const PLANCHE_RECIPE: Recipe = { id: '16489', itemId: '16489', ingredients: [{ resourceId: '303', quantity: 10 }] };
  const BOIS: Resource = { id: '303', name: 'Bois de Frêne', craftable: false };
  return {
    DAGUES: { id: '208', name: 'Dagues de Fouraille', level: 20, kind: 'Equipment' as const, categoryId: 'cat-1' },
    DAGUES_RECIPE: { id: '208', itemId: '208', ingredients: [{ resourceId: '16489', quantity: 2 }, { resourceId: '362', quantity: 3 }] } as Recipe,
    PLANCHE: { id: '16489', name: 'Planche Agglomérée', craftable: true } as Resource,
    PEAU: { id: '362', name: 'Peau de Larve Bleue', craftable: false } as Resource,
    getResourceRecipe: vi.fn(async (id: string) => (id === '16489' ? { recipe: PLANCHE_RECIPE, resources: [BOIS] } : null)),
    getCommunityPrice: vi.fn<(resourceId: string, serverId: string) => Promise<CommunityPriceLookup>>(),
  };
});

vi.mock('../../src/data/catalogue-repository', () => ({
  getCategories: vi.fn().mockResolvedValue([{ id: 'cat-1', label: 'Dagues', sortOrder: 1, kind: 'Equipment', typeIds: [] }]),
  searchItems: vi.fn().mockResolvedValue({ data: [DAGUES], total: 1 }),
  getItemDetail: vi.fn().mockResolvedValue({ recipe: DAGUES_RECIPE, resources: [PLANCHE, PEAU], stats: [] }),
  getResourceRecipe: (id: string) => getResourceRecipe(id),
  preloadCatalogueIndexes: vi.fn(),
  whenCatalogueReady: vi.fn().mockResolvedValue(undefined),
  getManifest: vi.fn().mockReturnValue({ sourceName: 'test', sourceVersion: '1', catalogueVersion: '1', publishedAt: new Date().toISOString() }),
}));

vi.mock('../../src/data/servers-repository', () => ({
  getServers: vi.fn().mockResolvedValue([{ id: 'mikhal', name: 'Mikhal', type: 'mono' }]),
}));

vi.mock('../../src/services/community-price-api', () => ({
  getCommunityPrice: (resourceId: string, serverId: string) => getCommunityPrice(resourceId, serverId),
  submitCommunityPrice: vi.fn().mockResolvedValue(undefined),
}));

import App from '../../src/app/App';
import { prices } from '../../src/persistence/indexeddb-resource-price-repository';
import { communityModePrices } from '../../src/persistence/indexeddb-community-mode-price-repository';
import { setIngredientChoice } from '../../src/persistence/ingredient-choices';

async function openSuivis() {
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
  fireEvent.click(screen.getByRole('link', { name: /Suivis/ }));
  return (await screen.findByText('Dagues de Fouraille')).closest('.pinned-card') as HTMLElement;
}

describe('page Suivis et ressources intermédiaires (specs/015 US4)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('craftcheck-price-mode-choice', 'personal');
    window.localStorage.setItem('craftcheck-search-tour-seen', '1');
    window.localStorage.setItem('craftcheck-pinned-items', JSON.stringify([{ item: DAGUES }]));
    globalThis.indexedDB = new IDBFactory();
    getCommunityPrice.mockReset();
    getCommunityPrice.mockResolvedValue({ status: 'not-found' });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows the same craft cost as the item detail, crafting the plank (4 300)', async () => {
    await prices.save('mikhal', '16489', 5000);
    await prices.save('mikhal', '362', 100);
    await prices.save('mikhal', '303', 200);
    const card = await openSuivis();
    await waitFor(() => expect(within(card).getByText(/Craft :/)).toHaveTextContent(n(`Craft : ${formatKamas(4300)}`)));
  });

  it('follows a forced "craft" choice like the item detail does, even when buying is cheaper (12 300)', async () => {
    await prices.save('mikhal', '16489', 5000);
    await prices.save('mikhal', '362', 100);
    await prices.save('mikhal', '303', 600);
    setIngredientChoice('16489', 'craft');
    const card = await openSuivis();
    // Planche forced to its recipe: 10 × 600 = 6 000 each → 2 × 6 000 + 3 × 100.
    await waitFor(() => expect(within(card).getByText(/Craft :/)).toHaveTextContent(n(`Craft : ${formatKamas(12300)}`)));
  });

  it('fills a sub-resource with no price from the community median in Mode communautaire', async () => {
    window.localStorage.setItem('craftcheck-price-mode-choice', 'community');
    await communityModePrices.save('mikhal', '16489', 5000);
    await communityModePrices.save('mikhal', '362', 100);
    getCommunityPrice.mockImplementation(async (resourceId) => (resourceId === '303'
      ? { status: 'found', price: { resourceId: '303', serverId: 'mikhal', medianAmountKamas: 200, sampleSize: 2 } }
      : { status: 'not-found' }));
    const card = await openSuivis();
    await waitFor(() => expect(within(card).getByText(/Craft :/)).toHaveTextContent(n(`Craft : ${formatKamas(4300)}`)));
  });
});
