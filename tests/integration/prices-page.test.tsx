import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { CommunityPriceLookup, SharedItemPricesLookup } from '../../src/services/community-price-api';
import type { Recipe, Resource } from '../../src/domain/types';

// specs/019-craft-profit-list, contracts/prices-page-ui.md.
// Anneau: r1 (1 000) → HDV 13 000 → +12 000. Bottes: r2 (500) → HDV 10 000 → +9 500 (+1 900 %).
// Coiffe: r3 bought 9 000 but crafted from 2 × r1 = 2 000 (« Auto ») → HDV 1 000 → −1 000.
// Dague: r4 has no price anywhere → not listed.
const getCommunityPrice = vi.fn<(resourceId: string, serverId: string) => Promise<CommunityPriceLookup>>();
const getSharedItemPrices = vi.fn<(serverId: string) => Promise<SharedItemPricesLookup>>();

vi.mock('../../src/services/community-price-api', () => ({
  getCommunityPrice: (resourceId: string, serverId: string) => getCommunityPrice(resourceId, serverId),
  getCommunityPrices: async (ids: string[], serverId: string) => {
    const results = await Promise.all(ids.map((id) => getCommunityPrice(id, serverId) as Promise<{ status: string; price?: unknown }>));
    if (results.some((result) => !result || result.status === 'unavailable')) return { status: 'unavailable' };
    return { status: 'found', prices: results.flatMap((result) => (result.status === 'found' ? [result.price] : [])) };
  },
  getSharedItemPrices: (serverId: string) => getSharedItemPrices(serverId),
  submitCommunityPrice: vi.fn().mockResolvedValue(undefined),
  getLatestItemPrice: vi.fn().mockResolvedValue({ status: 'not-found' }),
}));

const RESOURCES: Record<string, Resource> = {
  r1: { id: 'r1', name: 'Bois', craftable: false },
  r2: { id: 'r2', name: 'Fer', craftable: false },
  r3: { id: 'r3', name: 'Planche', craftable: true },
  r4: { id: 'r4', name: 'Rubis', craftable: false },
};
const recipe = (itemId: string, ingredients: [string, number][]): Recipe =>
  ({ id: `recipe-${itemId}`, itemId, ingredients: ingredients.map(([resourceId, quantity]) => ({ resourceId, quantity })) });
const RECIPES: Record<string, Recipe> = {
  anneau: recipe('anneau', [['r1', 1]]),
  bottes: recipe('bottes', [['r2', 1]]),
  coiffe: recipe('coiffe', [['r3', 1]]),
  dague: recipe('dague', [['r4', 1]]),
};
const ITEMS = [
  { id: 'anneau', name: 'Anneau' },
  { id: 'bottes', name: 'Bottes' },
  { id: 'coiffe', name: 'Coiffe' },
  { id: 'dague', name: 'Dague' },
];

vi.mock('../../src/data/catalogue-repository', () => ({
  getCategories: vi.fn().mockResolvedValue([]),
  searchItems: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getItemDetail: vi.fn(async (id: string) => ({
    recipe: RECIPES[id],
    resources: RECIPES[id].ingredients.map((ingredient) => RESOURCES[ingredient.resourceId]),
    stats: [],
  })),
  getResourceRecipe: vi.fn(async (resourceId: string) => (resourceId === 'r3'
    ? { recipe: recipe('r3', [['r1', 2]]), resources: [RESOURCES.r1] }
    : null)),
  getResourceDetails: vi.fn(async (ids: string[]) => ITEMS.filter((item) => ids.includes(item.id))),
  preloadCatalogueIndexes: vi.fn(),
  whenCatalogueReady: vi.fn().mockResolvedValue(undefined),
  getManifest: vi.fn().mockReturnValue({ sourceName: 'test', sourceVersion: '1', catalogueVersion: '1', publishedAt: new Date().toISOString() }),
}));

vi.mock('../../src/data/servers-repository', () => ({
  getServers: vi.fn().mockResolvedValue([{ id: 'mikhal', name: 'Mikhal', type: 'mono' }]),
}));

import App from '../../src/app/App';
import { pinnedItemPrices } from '../../src/persistence/indexeddb-pinned-item-price-repository';
import { resourcePricesFor } from '../../src/persistence/resource-prices-for-mode';
import { clearCraftProfitsCache } from '../../src/features/prices/useCraftProfits';

const MEDIANS: Record<string, number> = { r1: 1000, r2: 500, r3: 9000 };
const HDV: Record<string, number> = { anneau: 13000, bottes: 10000, coiffe: 1000, dague: 50000 };
const recent = new Date(Date.now() - 3_600_000).toISOString();

const normalize = (value: string | null) => (value ?? '').replace(/[\u202f\u00a0]/g, ' ');
const names = () => [...document.querySelectorAll('.profit-row')].map((row) => row.querySelector('.profit-row-main .resource-display > span:last-child')?.textContent);
const rowOf = (name: string) => [...document.querySelectorAll<HTMLElement>('.profit-row')].find((row) => row.textContent?.includes(name)) as HTMLElement;

async function openPrices(mode: 'community' | 'personal') {
  window.localStorage.setItem('craftcheck-price-mode-choice', mode);
  window.localStorage.setItem('craftcheck-search-tour-seen', '1');
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
  fireEvent.click(screen.getByRole('link', { name: 'Rentabilité' }));
}

describe('Prix page — craft profit (specs/019)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    globalThis.indexedDB = new IDBFactory();
    clearCraftProfitsCache();
    getCommunityPrice.mockReset();
    getCommunityPrice.mockImplementation(async (resourceId) => (MEDIANS[resourceId] === undefined
      ? { status: 'not-found' }
      : { status: 'found', price: { resourceId, serverId: 'mikhal', medianAmountKamas: MEDIANS[resourceId], sampleSize: 3 } }));
    getSharedItemPrices.mockReset();
    getSharedItemPrices.mockResolvedValue({
      status: 'found',
      items: Object.entries(HDV).map(([itemId, amountKamas]) => ({ itemId, amountKamas, contributedAt: recent })),
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('US1 — profitable items', () => {
    it('lists only computable items, by profit, with HDV price, date, cost, profit and margin', async () => {
      await openPrices('community');
      await waitFor(() => expect(names()).toEqual(['Anneau', 'Bottes', 'Coiffe']));
      const anneau = rowOf('Anneau');
      expect(normalize(anneau.textContent)).toContain('13 000');
      expect(normalize(anneau.textContent)).toContain('1 000');
      expect(normalize(anneau.querySelector('.profit-value')?.textContent ?? null)).toBe('Bénéfice+12 000');
      // The unit is the kamas icon, named for screen readers.
      expect(within(anneau).getAllByRole('img', { name: 'kamas' })).toHaveLength(3);
      expect(anneau.querySelector('.market-date')).toHaveTextContent(/il y a|heure/i);
      expect(rowOf('Coiffe').querySelector('.profit-value')).toHaveClass('profit-value--negative');
      expect(normalize(rowOf('Coiffe').querySelector('.profit-value')?.textContent ?? null)).toContain('−1 000');
      expect(screen.getByText('3 objets')).toBeInTheDocument();
    });

    it('shows the last list at once when coming back, and refreshes it in the background', async () => {
      await openPrices('community');
      await waitFor(() => expect(names()).toEqual(['Anneau', 'Bottes', 'Coiffe']));
      fireEvent.click(screen.getByRole('link', { name: 'Suivis' }));
      getSharedItemPrices.mockResolvedValue({ status: 'found', items: [{ itemId: 'anneau', amountKamas: 13000, contributedAt: recent }] });
      fireEvent.click(screen.getByRole('link', { name: 'Rentabilité' }));
      // Straight away, without « Calcul en cours… »: the list from the previous visit.
      expect(names()).toEqual(['Anneau', 'Bottes', 'Coiffe']);
      expect(screen.queryByText(/Calcul en cours/)).not.toBeInTheDocument();
      await waitFor(() => expect(names()).toEqual(['Anneau']));
    });

    it('opens the item in the Recherche page', async () => {
      await openPrices('community');
      await waitFor(() => expect(names()).toContain('Anneau'));
      fireEvent.click(within(rowOf('Anneau')).getByRole('button'));
      await waitFor(() => expect(window.location.pathname).not.toBe('/rentabilite'));
      expect(window.location.search).toContain('item=anneau');
      expect(new URLSearchParams(window.location.search).get('q')).toBe('Anneau');
    });

    it('says when no item is computable, with a way to the Recherche page', async () => {
      getSharedItemPrices.mockResolvedValue({ status: 'found', items: [] });
      await openPrices('community');
      expect(await screen.findByText('Aucun objet calculable')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Aller à la page Recherche' })).toBeInTheDocument();
    });

    it('says when the shared prices cannot be loaded', async () => {
      getSharedItemPrices.mockResolvedValue({ status: 'unavailable' });
      await openPrices('community');
      expect(await screen.findByText('Impossible de charger les prix partagés pour le moment.')).toBeInTheDocument();
    });
  });

  describe('US2 — same calculation as Recherche', () => {
    it('counts a craftable ingredient at its craft cost when cheaper, ignoring a forced « Acheter »', async () => {
      window.localStorage.setItem('craftcheck-ingredient-choices', JSON.stringify({ r3: 'buy' }));
      await openPrices('community');
      await waitFor(() => expect(names()).toContain('Coiffe'));
      // 2 × r1 = 2 000 kamas, not the 9 000 kamas purchase price.
      expect(normalize(rowOf('Coiffe').querySelectorAll('.profit-cell b')[1]?.textContent ?? null)).toBe('2 000');
    });

    it('keeps an item whose craftable ingredient has no purchase price but a computable craft', async () => {
      delete MEDIANS.r3;
      try {
        await openPrices('community');
        await waitFor(() => expect(names()).toContain('Coiffe'));
      } finally {
        MEDIANS.r3 = 9000;
      }
    });

    it('uses the device carnet and HDV prices in Mode personnel', async () => {
      await pinnedItemPrices.save('mikhal', 'bottes', 20000);
      await resourcePricesFor('personal').save('mikhal', 'r2', 4000);
      await openPrices('personal');
      await waitFor(() => expect(names()).toEqual(['Bottes']));
      expect(normalize(rowOf('Bottes').textContent)).toContain('+16 000');
      expect(getSharedItemPrices).not.toHaveBeenCalled();
    });
  });

  describe('US3 — find an item', () => {
    it('filters by name and sorts by clicking a column, twice to reverse', async () => {
      await openPrices('community');
      await waitFor(() => expect(names()).toEqual(['Anneau', 'Bottes', 'Coiffe']));

      expect(screen.queryByRole('combobox', { name: /Trier/ })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Trier par Marge' }));
      expect(names()).toEqual(['Bottes', 'Anneau', 'Coiffe']);
      expect(screen.getByRole('button', { name: 'Trier par Marge' })).toHaveAttribute('aria-pressed', 'true');
      fireEvent.click(screen.getByRole('button', { name: 'Trier par Marge' }));
      expect(names()).toEqual(['Coiffe', 'Anneau', 'Bottes']);
      fireEvent.click(screen.getByRole('button', { name: 'Trier par Nom' }));
      expect(names()).toEqual(['Anneau', 'Bottes', 'Coiffe']);

      fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher un objet' }), { target: { value: 'ANN' } });
      expect(names()).toEqual(['Anneau']);
      expect(screen.getByText('1 objet')).toBeInTheDocument();
    });
  });
});
