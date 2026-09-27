import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { CommunityPricesLookup } from '../../src/services/community-price-api';

// specs/022-pet-xp-calculator. Real reference data (src/data/pet-xp-data.json): Peau de Rat (8482)
// 1 XP / unit, Pépite (14635) 1,25 XP / unit, Rune Pa Vi (1548) 1 XP / 4 units.
const getCommunityPrices = vi.fn<(ids: string[], serverId: string) => Promise<CommunityPricesLookup>>();

vi.mock('../../src/services/community-price-api', () => ({
  getCommunityPrice: vi.fn().mockResolvedValue({ status: 'not-found' }),
  getCommunityPrices: (ids: string[], serverId: string) => getCommunityPrices(ids, serverId),
  getSharedItemPrices: vi.fn().mockResolvedValue({ status: 'found', items: [] }),
  submitCommunityPrice: vi.fn().mockResolvedValue(undefined),
  getLatestItemPrice: vi.fn().mockResolvedValue({ status: 'not-found' }),
}));

vi.mock('../../src/data/catalogue-repository', () => ({
  getCategories: vi.fn().mockResolvedValue([]),
  searchItems: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getItemDetail: vi.fn(),
  getResourceRecipe: vi.fn().mockResolvedValue(null),
  getResourceDetails: vi.fn().mockResolvedValue([]),
  preloadCatalogueIndexes: vi.fn(),
  whenCatalogueReady: vi.fn().mockResolvedValue(undefined),
  getManifest: vi.fn().mockReturnValue({ sourceName: 'test', sourceVersion: '1', catalogueVersion: '1', publishedAt: new Date().toISOString() }),
}));

vi.mock('../../src/data/servers-repository', () => ({
  getServers: vi.fn().mockResolvedValue([{ id: 'mikhal', name: 'Mikhal', type: 'mono' }]),
}));

import App from '../../src/app/App';
import { PET_FOODS } from '../../src/domain/pet-xp';
import { resourcePricesFor } from '../../src/persistence/resource-prices-for-mode';

const normalize = (value: string | null | undefined) => (value ?? '').replace(/[\u202f\u00a0]/g, ' ');
const names = () => [...document.querySelectorAll('.pet-food-row .resource-display > span:last-child')].map((span) => span.textContent);
const rowOf = (name: string) => [...document.querySelectorAll<HTMLElement>('li.pet-food-row')].find((row) => row.textContent?.includes(name));
const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } });

async function openFamilier(mode: 'community' | 'personal') {
  window.localStorage.setItem('craftcheck-price-mode-choice', mode);
  window.localStorage.setItem('craftcheck-search-tour-seen', '1');
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
  fireEvent.click(screen.getByRole('link', { name: 'Familier' }));
  await screen.findByRole('heading', { name: 'Familier' });
}

describe('Familier page (specs/022)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    globalThis.indexedDB = new IDBFactory();
    getCommunityPrices.mockReset();
    getCommunityPrices.mockResolvedValue({ status: 'found', prices: [] });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('US1 — XP needed', () => {
    it('shows the XP to reach the target level, minus the XP already gained', async () => {
      await openFamilier('personal');
      type('Niveau actuel', '50');
      type('Niveau visé', '60');
      expect(normalize(screen.getByText(/XP nécessaire/).textContent)).toContain('3 141 XP');
      type('XP déjà gagnée dans ce niveau', '150');
      expect(normalize(screen.getByText(/XP nécessaire/).textContent)).toContain('2 991 XP');
    });

    it('says there is no XP to give when the target is not above the current level', async () => {
      await openFamilier('personal');
      type('Niveau actuel', '50');
      type('Niveau visé', '40');
      expect(screen.getByText(/Aucune XP à donner/)).toBeInTheDocument();
      expect(screen.queryByText('Ressources les moins chères')).not.toBeInTheDocument();
    });

    it('shows the most XP the current level can hold', async () => {
      await openFamilier('personal');
      type('Niveau actuel', '50');
      type('XP déjà gagnée dans ce niveau', '500');
      expect(screen.getByRole('alert')).toHaveTextContent('197');
    });

    it('remembers the levels on the device', async () => {
      await openFamilier('personal');
      type('Niveau actuel', '50');
      type('Niveau visé', '60');
      cleanup();
      render(<App />);
      fireEvent.click(await screen.findByRole('link', { name: 'Familier' }));
      expect(field('Niveau actuel').value).toBe('50');
      expect(field('Niveau visé').value).toBe('60');
    });
  });

  describe('US2 / US3 — cheapest resources', () => {
    it('lists priced resources by total cost with quantity, date, unpriced count and source', async () => {
      const carnet = resourcePricesFor('personal');
      await carnet.save('mikhal', '8482', 10); // Peau de Rat: 3 141 × 10 = 31 410
      await carnet.save('mikhal', '14635', 20); // Pépite: 2 513 × 20 = 50 260
      await carnet.save('mikhal', '1548', 1); // Rune Pa Vi: 12 564 × 1 = 12 564
      await openFamilier('personal');
      type('Niveau actuel', '50');
      type('Niveau visé', '60');
      await waitFor(() => expect(names()).toEqual(['Rune Pa Vi', 'Peau de Rat', 'Pépite']));
      const peau = normalize(rowOf('Peau de Rat')?.textContent);
      expect(peau).toContain('3 141');
      expect(peau).toContain('31 410');
      expect(normalize(rowOf('Pépite')?.textContent)).toContain('2 513');
      expect(rowOf('Peau de Rat')?.querySelector('.market-date')).toHaveTextContent(/maintenant|il y a/i);
      expect(normalize(screen.getByText(/sans prix connu/).textContent)).toContain(`${PET_FOODS.length - 3} ressources`);
      fireEvent.click(screen.getByRole('button', { name: 'Trier par XP par unité' }));
      expect(names()).toEqual(['Pépite', 'Peau de Rat', 'Rune Pa Vi']);
      fireEvent.click(screen.getByRole('button', { name: 'Trier par XP par unité' }));
      expect(names()).toEqual(['Rune Pa Vi', 'Peau de Rat', 'Pépite']);
      fireEvent.click(screen.getByRole('button', { name: 'Trier par Ressource' }));
      expect(names()).toEqual(['Peau de Rat', 'Pépite', 'Rune Pa Vi']);
      expect(screen.getByRole('link', { name: /Dofus Tool/ })).toHaveAttribute('href', 'https://www.dofustool.com/tableau-xp-familier-dofus/');
    });

    it('uses community medians for resources missing from the carnet, without writing them', async () => {
      getCommunityPrices.mockResolvedValue({
        status: 'found',
        prices: [{ resourceId: '8482', serverId: 'mikhal', medianAmountKamas: 2, sampleSize: 3, lastContributionAt: new Date().toISOString() }],
      });
      await openFamilier('community');
      type('Niveau actuel', '50');
      type('Niveau visé', '60');
      await waitFor(() => expect(names()).toEqual(['Peau de Rat']));
      expect(normalize(rowOf('Peau de Rat')?.textContent)).toContain('6 282');
      expect(rowOf('Peau de Rat')?.textContent).toContain('Médiane');
      expect(await resourcePricesFor('community').get('mikhal', '8482')).toBeUndefined();
    });

    it('explains that no recommendation is possible without prices', async () => {
      await openFamilier('personal');
      type('Niveau actuel', '50');
      type('Niveau visé', '60');
      expect(await screen.findByText('Aucune recommandation sans prix')).toBeInTheDocument();
    });
  });
});
