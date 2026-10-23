import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { CommunityPricesLookup } from '../../src/services/community-price-api';
import { DEFAULT_SITE_SETTINGS as ALL_PAGES } from '../../src/domain/site-settings';

// specs/022-pet-xp-calculator. Real reference data (src/data/pet-xp-data.json): Peau de Rat (8482)
// 2,646 XP / unit, Pépite (14635) 1 XP / unit, Rune Pa Vi (1548) 0,225 XP / unit. Level 50 → 60: 2 859 XP.
// specs/055-refonte-xp-familier: the 3 cheapest are on the podium, the table lists the others with their rank.
const getCommunityPrices = vi.fn<(ids: string[], serverId: string) => Promise<CommunityPricesLookup>>();

vi.mock('../../src/services/community-price-api', () => ({
  getCommunityPrice: vi.fn().mockResolvedValue({ status: 'not-found' }),
  getCommunityPrices: (ids: string[], serverId: string) => getCommunityPrices(ids, serverId),
  getCommunityLotPrices: vi.fn().mockResolvedValue({}),
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
import { PET_FOODS } from '../../src/domain/pet-xp';

const normalize = (value: string | null | undefined) => (value ?? '').replace(/[\u202f\u00a0]/g, ' ');
const names = () => [...document.querySelectorAll('.pet-food-row .resource-display > span:last-child')].map((span) => span.textContent);
const rowOf = (name: string) => [...document.querySelectorAll<HTMLElement>('li.pet-food-row')].find((row) => row.textContent?.includes(name));
const podiumNames = () => [...document.querySelectorAll('.pet-podium-card h3')].map((title) => title.textContent);
const cardOf = (name: string) => [...document.querySelectorAll<HTMLElement>('.pet-podium-card')].find((card) => card.querySelector('h3')?.textContent === name);
const ranks = () => [...document.querySelectorAll('li.pet-food-row .pet-food-rank')].map((rank) => Number(rank.textContent));
const xpToGive = () => normalize(document.querySelector('.pet-xp-needed b')?.textContent);
const frNumber = (text: string | null | undefined) => Number(normalize(text).replace(/ /g, '').replace(',', '.'));
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

// The page is lazy-loaded by the app shell: load it once up front so no test pays the cold import.
beforeAll(async () => { await import('../../src/features/pets/FamilierPage'); });

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
      expect(xpToGive()).toBe('2 859');
      type('XP totale du familier', '1853');
      expect(field('Niveau actuel').value).toBe('50');
      expect(xpToGive()).toBe('2 709');
      type('XP totale du familier', '261');
      expect(field('Niveau actuel').value).toBe('32');
    });

    it('says there is no XP to give when the pet already has the target level', async () => {
      await openFamilier('personal');
      type('XP totale du familier', '1703');
      type('Niveau visé', '40');
      expect(screen.getByText(/Aucune XP à donner/)).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Les moins chères pour cet objectif' })).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Toutes les ressources' })).not.toBeInTheDocument();
    });

    // specs/055 FR-002: where the pet stands on the way to level 100.
    it('shows the progress towards level 100 with the current level', async () => {
      await openFamilier('personal');
      type('XP totale du familier', '1703');
      const bar = screen.getByRole('progressbar', { name: 'Progression du familier' });
      expect(normalize(bar.getAttribute('aria-valuetext'))).toBe('0,9 %, niveau 50');
      type('XP totale du familier', '179592');
      expect(normalize(screen.getByRole('progressbar').getAttribute('aria-valuetext'))).toBe('100,0 %, niveau 100');
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
    it('puts the 3 cheapest on the podium by total cost, with quantity, date and their gap with the 1st', async () => {
      const carnet = resourcePricesFor('personal');
      await carnet.save('mikhal', '8482', 10); // Peau de Rat: 1 081 × 10 = 10 810
      await carnet.save('mikhal', '14635', 20); // Pépite: 2 859 × 20 = 57 180
      await carnet.save('mikhal', '1548', 1); // Rune Pa Vi: 12 707 × 1 = 12 707
      await openFamilier('personal');
      type('XP totale du familier', '1703');
      type('Niveau visé', '60');
      await waitFor(() => expect(podiumNames()).toEqual(['Peau de Rat', 'Rune Pa Vi', 'Pépite']));
      const peau = normalize(cardOf('Peau de Rat')?.textContent);
      expect(peau).toContain('1re · la moins chère');
      expect(peau).toContain('1 081');
      expect(peau).toContain('10 810');
      expect(normalize(cardOf('Rune Pa Vi')?.querySelector('.pet-podium-rank')?.textContent)).toBe('2e · +1 897');
      expect(normalize(cardOf('Pépite')?.querySelector('.pet-podium-rank')?.textContent)).toBe('3e · +46 370');
      expect(normalize(cardOf('Pépite')?.textContent)).toContain('57 180');
      expect(cardOf('Peau de Rat')?.querySelector('.market-date')).toHaveTextContent(/maintenant|il y a/i);
      expect(screen.queryByText(/sans prix connu|Dafous|indisponibles/)).not.toBeInTheDocument();
      // Every priced food is on the podium: the table says so rather than repeating them.
      expect(names()).toEqual([]);
      expect(screen.getByText('Toutes les ressources avec un prix sont sur le podium, plus haut.')).toBeInTheDocument();
    });

    it('lists the others from the 4th, their rank kept whatever the sort or the filter', async () => {
      const carnet = resourcePricesFor('personal');
      for (const [index, food] of PET_FOODS.slice(0, 10).entries()) await carnet.save('mikhal', food.itemId, 10 + index);
      await openFamilier('personal');
      type('XP totale du familier', '1703');
      type('Niveau visé', '60');
      await waitFor(() => expect(names()).toHaveLength(7));
      expect(podiumNames()).toHaveLength(3);
      expect(ranks()).toEqual([4, 5, 6, 7, 8, 9, 10]);
      const rankOf = new Map(names().map((name, index) => [name, ranks()[index]]));

      fireEvent.click(screen.getByRole('button', { name: 'Trier par XP' }));
      const xps = [...document.querySelectorAll('li.pet-food-row')].map((row) => frNumber(row.querySelectorAll('.profit-cell b')[0]?.textContent));
      expect(xps).toEqual([...xps].sort((a, b) => b - a));
      names().forEach((name, index) => expect(ranks()[index]).toBe(rankOf.get(name)));
      fireEvent.click(screen.getByRole('button', { name: 'Trier par Ressource' }));
      expect(names()).toEqual([...names()].sort((a, b) => (a ?? '').localeCompare(b ?? '', 'fr')));

      const fifth = [...rankOf].find(([, rank]) => rank === 5)?.[0] ?? '';
      fireEvent.change(screen.getByLabelText('Filtrer les ressources'), { target: { value: fifth } });
      expect(names()).toContain(fifth);
      expect(rowOf(fifth)?.querySelector('.pet-food-rank')).toHaveTextContent('5');
      expect(podiumNames()).toHaveLength(3); // the filter only narrows the table
    });

    it('recomputes quantities and totals with the Almanax of 23 July switch (FR-012)', async () => {
      await resourcePricesFor('personal').save('mikhal', '14635', 20); // Pépite, 1 XP / unit
      await openFamilier('personal');
      type('XP totale du familier', '1703');
      type('Niveau visé', '60');
      const almanax = screen.getByRole('switch', { name: /Almanax du 23 juillet/ });
      if ((almanax as HTMLInputElement).checked) fireEvent.click(almanax);
      await waitFor(() => expect(normalize(cardOf('Pépite')?.textContent)).toContain('57 180')); // 2 859 × 20
      fireEvent.click(almanax);
      const pepite = normalize(cardOf('Pépite')?.textContent);
      expect(pepite).toContain('1,5'); // XP per unit, boosted
      expect(pepite).toContain('1 906'); // 2 859 ÷ 1,5, rounded up
      expect(pepite).toContain('38 120');
      expect(xpToGive()).toBe('2 859');
    });

    it('narrows the list by resource name, accents and case ignored', async () => {
      const carnet = resourcePricesFor('personal');
      await carnet.save('mikhal', '8482', 10);
      await carnet.save('mikhal', '14635', 20);
      await carnet.save('mikhal', '1548', 1);
      await openFamilier('personal');
      type('XP totale du familier', '1703');
      type('Niveau visé', '60');
      await waitFor(() => expect(podiumNames()).toHaveLength(3));
      fireEvent.change(screen.getByLabelText('Filtrer les ressources'), { target: { value: 'pepite' } });
      expect(screen.getByText('Les ressources qui correspondent sont sur le podium, plus haut.')).toBeInTheDocument();
      expect(podiumNames()).toHaveLength(3);
      fireEvent.change(screen.getByLabelText('Filtrer les ressources'), { target: { value: 'Agathe' } });
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
      await waitFor(() => expect(podiumNames()).toEqual(['Peau de Rat']));
      expect(normalize(cardOf('Peau de Rat')?.textContent)).toContain('2 162');
      expect(cardOf('Peau de Rat')?.textContent).not.toMatch(/[Mm]édiane/);
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
      await waitFor(() => expect(podiumNames()).toEqual(['Peau de Rat']));
      expect(normalize(cardOf('Peau de Rat')?.textContent)).toContain('3 243');
      expect((await resourcePricesFor('community').get('mikhal', '8482'))?.unitPriceKamas).toBe(3);
    });

    it('explains that no recommendation is possible without prices', async () => {
      await openFamilier('personal');
      type('XP totale du familier', '1703');
      type('Niveau visé', '60');
      expect(await screen.findByText('Aucune recommandation sans prix')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Saisir des prix dans la page HDV' })).toHaveAttribute('href', '/hdv');
    });

    // specs/053-hdv-page-toggle: no invitation to a page the owner has turned off.
    it('does not send to the HDV page while it is disabled', async () => {
      window.localStorage.setItem('craftcheck-site-settings', JSON.stringify({ ...ALL_PAGES, forgemagiePage: false, hdvPage: false }));
      await openFamilier('personal');
      type('XP totale du familier', '1703');
      type('Niveau visé', '60');
      expect(await screen.findByText('Aucune recommandation sans prix')).toBeInTheDocument();
      expect(screen.getByText("Aucun prix n'est encore connu pour ces ressources sur ce serveur.")).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Saisir des prix dans la page HDV' })).not.toBeInTheDocument();
    });
  });
  // specs/022 FR-007 (revised 2026-09-28): every priced resource, 25 lines at a time as the end of
  // the list scrolls into view, with a « Revenir en haut » button — like the Rentabilité page.
  describe('scrolling list (FR-007, revised)', () => {
    let reveal: (() => void) | undefined;
    beforeEach(() => {
      reveal = undefined;
      vi.stubGlobal('IntersectionObserver', class {
        constructor(private readonly callback: IntersectionObserverCallback) {}
        observe() {
          reveal = () => this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
        }
        disconnect() {}
      });
    });
    afterEach(() => {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    });

    it('shows 25 lines after the podium, then the rest once the end of the list comes into view', async () => {
      const carnet = resourcePricesFor('personal');
      for (const [index, food] of PET_FOODS.slice(0, 40).entries()) await carnet.save('mikhal', food.itemId, 10 + index);
      await openFamilier('personal');
      type('XP totale du familier', '1703');
      type('Niveau visé', '60');
      await waitFor(() => expect(names()).toHaveLength(25));
      expect(document.querySelector('.profit-list-end')).toBeInTheDocument();
      expect(ranks()[0]).toBe(4); // the 3 cheapest are on the podium

      vi.useFakeTimers();
      act(() => reveal!());
      expect(screen.getByText('Chargement…')).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(1000));
      vi.useRealTimers();
      expect(names()).toHaveLength(37);
      expect(document.querySelector('.profit-list-end')).not.toBeInTheDocument();
    });

    it('goes back to the first 25 lines when the sort or the search changes', async () => {
      const carnet = resourcePricesFor('personal');
      for (const [index, food] of PET_FOODS.slice(0, 40).entries()) await carnet.save('mikhal', food.itemId, 10 + index);
      await openFamilier('personal');
      type('XP totale du familier', '1703');
      type('Niveau visé', '60');
      await waitFor(() => expect(names()).toHaveLength(25));
      vi.useFakeTimers();
      act(() => reveal!());
      act(() => vi.advanceTimersByTime(1000));
      vi.useRealTimers();
      expect(names()).toHaveLength(37);

      fireEvent.click(screen.getByRole('button', { name: 'Trier par XP' }));
      expect(names()).toHaveLength(25);
    });

    it('offers « Revenir en haut » once the page is scrolled down', async () => {
      await openFamilier('personal');
      expect(screen.queryByRole('button', { name: 'Revenir en haut' })).not.toBeInTheDocument();
      Object.defineProperty(window, 'scrollY', { value: 800, configurable: true });
      fireEvent.scroll(window);
      expect(await screen.findByRole('button', { name: 'Revenir en haut' })).toBeInTheDocument();
      Object.defineProperty(window, 'scrollY', { value: 0, configurable: true });
    });
  });
  // specs/055 US3: one food looked up, with what it costs for the objective and its rank.
  describe('« Viser une ressource précise » (specs/055)', () => {
    const aim = (query: string, name: string) => {
      fireEvent.change(screen.getByLabelText('Rechercher une ressource à viser'), { target: { value: query } });
      fireEvent.click(within(screen.getByRole('group', { name: 'Suggestions' })).getByRole('button', { name }));
      return screen.getByRole('region', { name: `Fiche de ${name}` });
    };

    async function openWithThreeFoods() {
      const carnet = resourcePricesFor('personal');
      await carnet.save('mikhal', '8482', 10); // Peau de Rat: 10 810
      await carnet.save('mikhal', '14635', 20); // Pépite: 57 180
      await carnet.save('mikhal', '1548', 1); // Rune Pa Vi: 12 707
      await openFamilier('personal');
      type('XP totale du familier', '1703');
      type('Niveau visé', '60');
      await waitFor(() => expect(podiumNames()).toHaveLength(3));
    }

    it('shows the rank, cost, gap with the 1st and share of the objective of a priced food', async () => {
      await openWithThreeFoods();
      const card = normalize(aim('pepi', 'Pépite').textContent);
      expect(card).toContain('1 XP par unité · 3e la moins chère');
      expect(card).toContain('2 859'); // quantity
      expect(card).toContain('57 180');
      expect(card).toContain('+429 %'); // (57 180 − 10 810) ÷ 10 810 = 428,95 %
      expect(card).toContain('0,035 % de l\'objectif'); // 1 ÷ 2 859
      expect(field('Rechercher une ressource à viser').value).toBe('Pépite');
      expect(screen.queryByRole('group', { name: 'Suggestions' })).not.toBeInTheDocument();
    });

    it('says the price is unknown for a food without price, and nothing matches an unknown name', async () => {
      await openWithThreeFoods();
      const card = normalize(aim('agathe', 'Agathe').textContent);
      expect(card).toContain('Prix inconnu');
      expect(card).not.toContain('la moins chère');
      fireEvent.change(field('Rechercher une ressource à viser'), { target: { value: 'zzz' } });
      expect(screen.getByText('Ne correspond à aucune ressource.')).toBeInTheDocument();
    });

    it('follows the Almanax switch', async () => {
      await openWithThreeFoods();
      const almanax = screen.getByRole('switch', { name: /Almanax du 23 juillet/ });
      if ((almanax as HTMLInputElement).checked) fireEvent.click(almanax);
      aim('pepi', 'Pépite');
      fireEvent.click(almanax);
      expect(normalize(screen.getByRole('region', { name: 'Fiche de Pépite' }).textContent)).toContain('38 120');
    });

    it('says a food above « Quantité max » is not ranked', async () => {
      await openWithThreeFoods();
      type('Quantité max', '1000');
      const card = normalize(aim('peau de r', 'Peau de Rat').textContent);
      expect(card).toContain('Non classée (plus de 1 000 unités)');
      expect(card).not.toContain('Écart avec la 1re');
    });
  });

  // specs/022 FR-008b (2026-09-29). Level 0 → 100 = 179 592 XP: Peau de Rat (2,646 XP) needs 67 873
  // units, Rune Pa Vi (0,225 XP) 798 187 — both above the default 50 000 cap —, the food giving the
  // most XP per unit far fewer.
  describe('« Quantité max » (FR-008b)', () => {
    const richest = [...PET_FOODS].sort((a, b) => b.xpPerUnit - a.xpPerUnit)[0];

    async function openWithThreeFoods() {
      const carnet = resourcePricesFor('personal');
      await carnet.save('mikhal', '8482', 10);
      await carnet.save('mikhal', '1548', 1);
      await carnet.save('mikhal', richest.itemId, 500);
      await openFamilier('personal');
      type('XP totale du familier', '0');
      type('Niveau visé', '100');
    }

    it('hides the resources needing more than 50 000 units by default, and says how many', async () => {
      await openWithThreeFoods();
      await waitFor(() => expect(podiumNames()).toEqual([richest.name]));
      expect(field('Quantité max').value).toBe('50000');
      expect(normalize(screen.getByText(/ressources masquées/).textContent)).toBe('2 ressources masquées (plus de 50 000 unités)');
    });

    it('shows them again under a higher cap or with the field emptied, and remembers it', async () => {
      await openWithThreeFoods();
      await waitFor(() => expect(podiumNames()).toEqual([richest.name]));

      type('Quantité max', '70000');
      await waitFor(() => expect(podiumNames()).toHaveLength(2));
      expect(podiumNames()).toContain('Peau de Rat');
      expect(normalize(screen.getByText(/ressource masquée/).textContent)).toBe('1 ressource masquée (plus de 70 000 unités)');

      type('Quantité max', '');
      await waitFor(() => expect(podiumNames()).toHaveLength(3));
      expect(screen.queryByText(/masquée/)).not.toBeInTheDocument();

      cleanup();
      document.body.innerHTML = '';
      render(<App />);
      fireEvent.click(await screen.findByRole('link', { name: 'XP Familier' }));
      await waitFor(() => expect(podiumNames()).toHaveLength(3));
      expect(field('Quantité max').value).toBe('');
    });

    it('says so when every resource needs more units than the cap', async () => {
      await openWithThreeFoods();
      await waitFor(() => expect(podiumNames()).toEqual([richest.name]));
      type('Quantité max', '10');
      expect(await screen.findByText('Toutes les ressources demandent plus de 10 unités')).toBeInTheDocument();
      expect(podiumNames()).toEqual([]);
      expect(names()).toEqual([]);
    });

    it('keeps the last valid cap while the field holds an invalid value', async () => {
      await openWithThreeFoods();
      await waitFor(() => expect(podiumNames()).toEqual([richest.name]));
      type('Quantité max', '0');
      expect(field('Quantité max')).toHaveAttribute('aria-invalid', 'true');
      expect(podiumNames()).toEqual([richest.name]);
    });
  });
  // specs/022 FR-002 (2026-09-29): an emptied « Niveau actuel » counts as level 0.
  it('treats an emptied current level as level 0, without an error', async () => {
    await openFamilier('personal');
    type('Niveau actuel', '50');
    expect(field('XP totale du familier').value).not.toBe('0');
    type('Niveau actuel', '');
    expect(field('Niveau actuel')).toHaveAttribute('placeholder', '0');
    expect(field('XP totale du familier').value).toBe('0');
    expect(screen.queryByText(/Niveau entre/)).not.toBeInTheDocument();
    type('Niveau visé', '100');
    expect(xpToGive()).toBe('179 592');
  });
});
