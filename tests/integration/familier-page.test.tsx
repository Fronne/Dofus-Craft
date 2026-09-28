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
  fireEvent.click(screen.getByRole('link', { name: 'XP Familier' }));
  await screen.findByRole('heading', { name: 'XP Familier' });
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
    it('turns levels saved in the former format into total XP', async () => {
      window.localStorage.setItem('craftcheck-pet-levels', JSON.stringify({ currentLevel: 50, xpInLevel: 150, targetLevel: 60 }));
      await openFamilier('personal');
      expect(field('XP totale du familier').value).toBe('1853');
      expect(field('Niveau actuel').value).toBe('50');
      expect(field('Niveau visé').value).toBe('60');
    });


    it('fills the total XP from the level typed, and the level from the total XP typed', async () => {
      await openFamilier('personal');
      type('Niveau actuel', '50');
      type('Niveau visé', '60');
      expect(field('XP totale du familier').value).toBe('1703');
      expect(normalize(document.querySelector('.pet-xp-needed')?.textContent)).toContain('2 859 XP');
      type('XP totale du familier', '1853');
      expect(field('Niveau actuel').value).toBe('50');
      expect(normalize(document.querySelector('.pet-xp-needed')?.textContent)).toContain('2 709 XP');
      type('XP totale du familier', '261');
      expect(field('Niveau actuel').value).toBe('32');
    });

    it('says there is no XP to give when the pet already has the target level', async () => {
      await openFamilier('personal');
      type('XP totale du familier', '1703');
      type('Niveau visé', '40');
      expect(screen.getByText(/Aucune XP à donner/)).toBeInTheDocument();
      expect(screen.queryByText('Ressources les moins chères')).not.toBeInTheDocument();
    });

    it('brings a value typed above the maximum back to it', async () => {
      await openFamilier('personal');
      type('Niveau visé', '150');
      expect(field('Niveau visé').value).toBe('100');
      type('XP totale du familier', '999999');
      expect(field('XP totale du familier').value).toBe('179592');
      expect(field('Niveau actuel').value).toBe('100');
      type('Niveau actuel', '150');
      expect(field('Niveau actuel').value).toBe('100');
    });

    it('rejects a negative total XP', async () => {
      await openFamilier('personal');
      type('XP totale du familier', '-5');
      expect(screen.getByRole('alert')).toHaveTextContent('179 592');
    });

    it('remembers the levels on the device', async () => {
      await openFamilier('personal');
      type('XP totale du familier', '1703');
      type('Niveau visé', '60');
      cleanup();
      render(<App />);
      fireEvent.click(await screen.findByRole('link', { name: 'XP Familier' }));
      expect(field('XP totale du familier').value).toBe('1703');
      expect(field('Niveau visé').value).toBe('60');
    });
  });

  describe('US2 / US3 — cheapest resources', () => {
    it('lists priced resources by total cost with quantity and date, without the notes below the list', async () => {
      const carnet = resourcePricesFor('personal');
      await carnet.save('mikhal', '8482', 10); // Peau de Rat: 1 081 × 10 = 10 810
      await carnet.save('mikhal', '14635', 20); // Pépite: 2 859 × 20 = 57 180
      await carnet.save('mikhal', '1548', 1); // Rune Pa Vi: 12 707 × 1 = 12 707
      await openFamilier('personal');
      type('XP totale du familier', '1703');
      type('Niveau visé', '60');
      await waitFor(() => expect(names()).toEqual(['Peau de Rat', 'Rune Pa Vi', 'Pépite']));
      const peau = normalize(rowOf('Peau de Rat')?.textContent);
      expect(peau).toContain('1 081');
      expect(peau).toContain('10 810');
      expect(normalize(rowOf('Pépite')?.textContent)).toContain('57 180');
      expect(rowOf('Peau de Rat')?.querySelector('.market-date')).toHaveTextContent(/maintenant|il y a/i);
      expect(screen.queryByText(/sans prix connu|Dafous|indisponibles/)).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Trier par XP' }));
      expect(names()).toEqual(['Peau de Rat', 'Pépite', 'Rune Pa Vi']);
      fireEvent.click(screen.getByRole('button', { name: 'Trier par XP' }));
      expect(names()).toEqual(['Rune Pa Vi', 'Pépite', 'Peau de Rat']);
      fireEvent.click(screen.getByRole('button', { name: 'Trier par Ressource' }));
      expect(names()).toEqual(['Peau de Rat', 'Pépite', 'Rune Pa Vi']);
    });

    it('recomputes quantities and totals with the Almanax of 23 July switch (FR-012)', async () => {
      await resourcePricesFor('personal').save('mikhal', '14635', 20); // Pépite, 1 XP / unit
      await openFamilier('personal');
      type('XP totale du familier', '1703');
      type('Niveau visé', '60');
      const almanax = screen.getByRole('switch', { name: /Almanax du 23 juillet/ });
      if ((almanax as HTMLInputElement).checked) fireEvent.click(almanax);
      await waitFor(() => expect(normalize(rowOf('Pépite')?.textContent)).toContain('57 180')); // 2 859 × 20
      fireEvent.click(almanax);
      const pepite = normalize(rowOf('Pépite')?.textContent);
      expect(pepite).toContain('1,5'); // XP per unit, boosted
      expect(pepite).toContain('1 906'); // 2 859 ÷ 1,5, rounded up
      expect(pepite).toContain('38 120');
      expect(normalize(document.querySelector('.pet-xp-needed')?.textContent)).toContain('2 859 XP');
    });

    it('narrows the list by resource name, accents and case ignored', async () => {
      const carnet = resourcePricesFor('personal');
      await carnet.save('mikhal', '8482', 10);
      await carnet.save('mikhal', '14635', 20);
      await carnet.save('mikhal', '1548', 1);
      await openFamilier('personal');
      type('XP totale du familier', '1703');
      type('Niveau visé', '60');
      await waitFor(() => expect(names()).toHaveLength(3));
      fireEvent.change(screen.getByLabelText('Rechercher une ressource'), { target: { value: 'pepite' } });
      expect(names()).toEqual(['Pépite']);
      fireEvent.change(screen.getByLabelText('Rechercher une ressource'), { target: { value: 'Agathe' } });
      expect(screen.getByText('Aucune ressource avec un prix ne correspond')).toBeInTheDocument();
      expect(screen.getByText(/2 ressources correspondent, mais sans prix connu/)).toBeInTheDocument();
    });

    // specs/024-latest-community-price: the latest shared price, never the median, written to the
    // carnet with its own date when it is more recent than the carnet's entry.
    it('uses the latest shared price, not the median, and writes it to the carnet with its date', async () => {
      const sharedAt = new Date(Date.now() - 60_000).toISOString();
      getCommunityPrices.mockResolvedValue({
        status: 'found',
        prices: [{ resourceId: '8482', serverId: 'mikhal', medianAmountKamas: 5, sampleSize: 3, lastContributionAt: sharedAt, latestAmountKamas: 2, latestContributionAt: sharedAt }],
      });
      await openFamilier('community');
      type('XP totale du familier', '1703');
      type('Niveau visé', '60');
      await waitFor(() => expect(names()).toEqual(['Peau de Rat']));
      expect(normalize(rowOf('Peau de Rat')?.textContent)).toContain('2 162');
      expect(rowOf('Peau de Rat')?.textContent).not.toMatch(/[Mm]édiane/);
      expect(await resourcePricesFor('community').get('mikhal', '8482')).toEqual({ resourceId: '8482', unitPriceKamas: 2, updatedAt: sharedAt });
    });

    it('keeps a carnet price more recent than the latest shared one (specs/024)', async () => {
      await resourcePricesFor('community').save('mikhal', '8482', 3);
      getCommunityPrices.mockResolvedValue({
        status: 'found',
        prices: [{ resourceId: '8482', serverId: 'mikhal', medianAmountKamas: 2, sampleSize: 3, latestAmountKamas: 2, latestContributionAt: '2026-09-01T12:00:00.000Z' }],
      });
      await openFamilier('community');
      type('XP totale du familier', '1703');
      type('Niveau visé', '60');
      await waitFor(() => expect(names()).toEqual(['Peau de Rat']));
      expect(normalize(rowOf('Peau de Rat')?.textContent)).toContain('3 243');
      expect((await resourcePricesFor('community').get('mikhal', '8482'))?.unitPriceKamas).toBe(3);
    });

    it('explains that no recommendation is possible without prices', async () => {
      await openFamilier('personal');
      type('XP totale du familier', '1703');
      type('Niveau visé', '60');
      expect(await screen.findByText('Aucune recommandation sans prix')).toBeInTheDocument();
    });
  });
});
