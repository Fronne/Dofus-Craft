import { IDBFactory } from 'fake-indexeddb';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatKamas } from '../../src/domain/kamas';
import type { LatestItemPriceLookup } from '../../src/services/community-price-api';

const n = (value: string) => value.replace(/\u202f/g, ' ');

const { getLatestItemPrice } = vi.hoisted(() => ({
  getLatestItemPrice: vi.fn<(itemId: string, serverId: string) => Promise<LatestItemPriceLookup>>(),
}));

vi.mock('../../src/services/community-price-api', () => ({
  getLatestItemPrice: (itemId: string, serverId: string) => getLatestItemPrice(itemId, serverId),
  getCommunityPrice: vi.fn().mockResolvedValue({ status: 'not-found' }),
  submitCommunityPrice: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/data/catalogue-repository', () => ({
  getCategories: vi.fn().mockResolvedValue([{ id: 'cat-1', label: 'Dagues', sortOrder: 1, kind: 'Equipment', typeIds: [] }]),
  searchItems: vi.fn().mockResolvedValue({ data: [{ id: '208', name: 'Dagues de Fouraille', level: 13, kind: 'Equipment', categoryId: 'cat-1' }], total: 1 }),
  getItemDetail: vi.fn().mockResolvedValue({
    recipe: { id: '208', itemId: '208', ingredients: [{ resourceId: '362', quantity: 3 }] },
    resources: [{ id: '362', name: 'Peau de Larve Bleue', craftable: false }],
    stats: [],
  }),
  getResourceRecipe: vi.fn().mockResolvedValue(null),
  preloadCatalogueIndexes: vi.fn(),
  whenCatalogueReady: vi.fn().mockResolvedValue(undefined),
  getManifest: vi.fn().mockReturnValue({ sourceName: 'test', sourceVersion: '1', catalogueVersion: '1', publishedAt: new Date().toISOString() }),
}));

vi.mock('../../src/data/servers-repository', () => ({
  getServers: vi.fn().mockResolvedValue([{ id: 'mikhal', name: 'Mikhal', type: 'mono' }]),
}));

import App from '../../src/app/App';
import { pinnedItemPrices } from '../../src/persistence/indexeddb-pinned-item-price-repository';
import { communityModePrices } from '../../src/persistence/indexeddb-community-mode-price-repository';

async function openSuivisCard() {
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
  fireEvent.click(screen.getByRole('link', { name: /Suivis/ }));
  return (await screen.findByText('Dagues de Fouraille')).closest('.pinned-card') as HTMLElement;
}

describe('page Suivis et prix HDV partagé (specs/016 US4)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('craftcheck-search-tour-seen', '1');
    window.localStorage.setItem('craftcheck-pinned-items', JSON.stringify([
      { item: { id: '208', name: 'Dagues de Fouraille', level: 13, kind: 'Equipment', categoryId: 'cat-1' } },
    ]));
    globalThis.indexedDB = new IDBFactory();
    getLatestItemPrice.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows the latest shared HDV price in Mode communautaire and compares against it', async () => {
    window.localStorage.setItem('craftcheck-price-mode-choice', 'community');
    await communityModePrices.save('mikhal', '362', 1000);
    getLatestItemPrice.mockResolvedValue({ status: 'found', price: { itemId: '208', serverId: 'mikhal', amountKamas: 8000, contributedAt: new Date().toISOString() } });
    const card = await openSuivisCard();
    await waitFor(() => expect(within(card).getByText(/HDV :/)).toHaveTextContent(n(`HDV : ${formatKamas(8000)}`)));
    // 3 × 1 000 craft vs 8 000 HDV: crafting is cheaper.
    expect(within(card).getByText(/Craft :/)).toHaveTextContent(n(`Craft : ${formatKamas(3000)}`));
  });

  it('keeps the local HDV price in Mode personnel', async () => {
    window.localStorage.setItem('craftcheck-price-mode-choice', 'personal');
    await pinnedItemPrices.save('mikhal', '208', 4500);
    const card = await openSuivisCard();
    await waitFor(() => expect(within(card).getByText(/HDV :/)).toHaveTextContent(n(`HDV : ${formatKamas(4500)}`)));
    expect(getLatestItemPrice).not.toHaveBeenCalled();
  });
});
