import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { CommunityPricesLookup } from '../../src/services/community-price-api';

// specs/022-pet-xp-calculator. Real reference data (src/data/pet-xp-data.json): Peau de Rat (8482)
// 2,646 XP / unit, Pépite (14635) 1 XP / unit, Rune Pa Vi (1548) 0,225 XP / unit. Level 50 → 60: 2 859 XP.
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
      expect(normalize(screen.getByText(/XP nécessaire/).textContent)).toContain('2 859 XP');
      type('XP déjà gagnée dans ce niveau', '150');
      expect(normalize(screen.getByText(/XP nécessaire/).textContent)).toContain('2 709 XP');
    });

    it('says there is no XP to give when the target is not above the current level', async () => {
      await openFamilier('personal');
      type('Niveau actuel', '50');
      type('Niveau visé', '40');
      expect(screen.getByText(/Aucune XP à donner/)).toBeInTheDocument();
      expect(screen.queryByText('Ressources les moins chères')).not.toBeInTheDocument();
    });

    it('brings a level typed above the maximum back to it', async () => {
      await openFamilier('personal');
      type('Niveau visé', '150');
      expect(field('Niveau visé').value).toBe('100');
      type('Niveau actuel', '120');
      expect(field('Niveau actuel').value).toBe('99');
    });

    it('shows the most XP the current level can hold', async () => {
      await openFamilier('personal');
      type('Niveau actuel', '50');
      type('XP déjà gagnée dans ce niveau', '500');
      expect(screen.getByRole('alert')).toHaveTextContent('179');
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
      await carnet.save('mikhal', '8482', 10); // Peau de Rat: 1 081 × 10 = 10 810
      await carnet.save('mikhal', '14635', 20); // Pépite: 2 859 × 20 = 57 180
      await carnet.save('mikhal', '1548', 1); // Rune Pa Vi: 12 707 × 1 = 12 707
      await openFamilier('personal');
      type('Niveau actuel', '50');
      type('Niveau visé', '60');
      await waitFor(() => expect(names()).toEqual(['Peau de Rat', 'Rune Pa Vi', 'Pépite']));
      const peau = normalize(rowOf('Peau de Rat')?.textContent);
      expect(peau).toContain('1 081');
      expect(peau).toContain('10 810');
      expect(normalize(rowOf('Pépite')?.textContent)).toContain('57 180');
      expect(rowOf('Peau de Rat')?.querySelector('.market-date')).toHaveTextContent(/maintenant|il y a/i);
      expect(normalize(screen.getByText(/sans prix connu/).textContent)).toContain(`${new Intl.NumberFormat('fr-FR').format(PET_FOODS.length - 3).replace(/[\u202f\u00a0]/g, ' ')} ressources`);
      fireEvent.click(screen.getByRole('button', { name: 'Trier par XP' }));
      expect(names()).toEqual(['Peau de Rat', 'Pépite', 'Rune Pa Vi']);
      fireEvent.click(screen.getByRole('button', { name: 'Trier par XP' }));
      expect(names()).toEqual(['Rune Pa Vi', 'Pépite', 'Peau de Rat']);
      fireEvent.click(screen.getByRole('button', { name: 'Trier par Ressource' }));
      expect(names()).toEqual(['Peau de Rat', 'Pépite', 'Rune Pa Vi']);
      expect(screen.getByRole('link', { name: /Dafous/ })).toHaveAttribute('href', 'https://dafous.app/pet-xp');
    });

    it('recomputes quantities and totals with the Almanax of 23 July switch (FR-012)', async () => {
      await resourcePricesFor('personal').save('mikhal', '14635', 20); // Pépite, 1 XP / unit
      await openFamilier('personal');
      type('Niveau actuel', '50');
      type('Niveau visé', '60');
      const almanax = screen.getByRole('switch', { name: /Almanax du 23 juillet/ });
      if ((almanax as HTMLInputElement).checked) fireEvent.click(almanax);
      await waitFor(() => expect(normalize(rowOf('Pépite')?.textContent)).toContain('57 180')); // 2 859 × 20
      fireEvent.click(almanax);
      const pepite = normalize(rowOf('Pépite')?.textContent);
      expect(pepite).toContain('1,5'); // XP per unit, boosted
      expect(pepite).toContain('1 906'); // 2 859 ÷ 1,5, rounded up
      expect(pepite).toContain('38 120');
      expect(normalize(screen.getByText(/XP nécessaire/).textContent)).toContain('2 859 XP');
    });

    it('narrows the list by resource name, accents and case ignored', async () => {
      const carnet = resourcePricesFor('personal');
      await carnet.save('mikhal', '8482', 10);
      await carnet.save('mikhal', '14635', 20);
      await carnet.save('mikhal', '1548', 1);
      await openFamilier('personal');
      type('Niveau actuel', '50');
      type('Niveau visé', '60');
      await waitFor(() => expect(names()).toHaveLength(3));
      fireEvent.change(screen.getByLabelText('Rechercher une ressource'), { target: { value: 'pepite' } });
      expect(names()).toEqual(['Pépite']);
      fireEvent.change(screen.getByLabelText('Rechercher une ressource'), { target: { value: 'Agathe' } });
      expect(screen.getByText('Aucune ressource avec un prix ne correspond')).toBeInTheDocument();
      expect(screen.getByText(/2 ressources correspondent, mais sans prix connu/)).toBeInTheDocument();
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
      expect(normalize(rowOf('Peau de Rat')?.textContent)).toContain('2 162');
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
