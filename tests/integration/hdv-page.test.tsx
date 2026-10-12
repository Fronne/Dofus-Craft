import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { CommunityPriceLookup, CommunityPricesLookup } from '../../src/services/community-price-api';

// specs/023-hdv-price-entry. Real data (src/data/hdv-items.json): the Créatures tab lists the 35
// exchangeable pet foods, among them Croquette enrichie (20125), which is also in the pet XP table.
const getCommunityPrice = vi.fn<(id: string, serverId: string) => Promise<CommunityPriceLookup>>();
const getCommunityPrices = vi.fn<(ids: string[], serverId: string) => Promise<CommunityPricesLookup>>();

vi.mock('../../src/services/community-price-api', () => ({
  getCommunityPrice: (id: string, serverId: string) => getCommunityPrice(id, serverId),
  getCommunityPrices: (ids: string[], serverId: string) => getCommunityPrices(ids, serverId),
  getSharedItemPrices: vi.fn().mockResolvedValue({ status: 'found', items: [] }),
  submitCommunityPrice: vi.fn().mockResolvedValue(undefined),
  getLatestItemPrice: vi.fn().mockResolvedValue({ status: 'not-found' }),
  getPriceHistory: vi.fn().mockResolvedValue({ status: 'found', points: [] }),
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

const CROQUETTE = { id: '20125', name: 'Croquette enrichie' };

async function openHdv(mode: 'community' | 'personal', tab: 'resources' | 'consumables' | 'animals' | 'runes' = 'animals') {
  window.localStorage.setItem('craftcheck-price-mode-choice', mode);
  window.localStorage.setItem('craftcheck-search-tour-seen', '1');
  window.localStorage.setItem('craftcheck-hdv-tab', tab);
  const view = render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
  fireEvent.click(screen.getByRole('link', { name: 'HDV' }));
  await screen.findByRole('heading', { name: 'HDV' });
  await waitFor(() => expect(document.querySelectorAll('li.hdv-row').length).toBeGreaterThan(0));
  return view;
}

const rows = () => [...document.querySelectorAll<HTMLElement>('li.hdv-row')];
const rowOf = (name: string) => rows().find((row) => row.querySelector('.resource-display')?.textContent?.includes(name));
const names = () => rows().map((row) => row.querySelector('.resource-display')?.textContent ?? '');
const priceInput = (name: string) => within(rowOf(name)!).getByPlaceholderText('Prix unitaire') as HTMLInputElement;
const status = () => screen.queryByText(/ont un prix|a un prix/)?.textContent;
const normalize = (value: string) => value.replace(/[\u202f\u00a0]/g, ' ');

function typePrice(name: string, value: string) {
  const input = priceInput(name);
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

describe('HDV page (specs/023)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    globalThis.indexedDB = new IDBFactory();
    getCommunityPrice.mockReset();
    getCommunityPrice.mockResolvedValue({ status: 'not-found' });
    getCommunityPrices.mockReset();
    // Lines read their medians in batches: answer each id as `getCommunityPrice` would.
    getCommunityPrices.mockImplementation(async (ids, serverId) => {
      const results = await Promise.all(ids.map((id) => getCommunityPrice(id, serverId)));
      return { status: 'found', prices: results.flatMap((result) => (result.status === 'found' ? [result.price] : [])) };
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('US1 — record the prices of one HDV', () => {
    it('replaces Accueil with an HDV entry between Prix and Familier', async () => {
      await openHdv('personal');
      const links = within(screen.getByRole('navigation', { name: 'Navigation principale' })).getAllByRole('link').map((link) => link.textContent);
      expect(links).not.toContain('Accueil');
      expect(links.indexOf('HDV')).toBe(links.indexOf('Rentabilité') + 1);
      expect(links.indexOf('XP Familier')).toBe(links.indexOf('HDV') + 1);
    });

    it('lists the pet foods of the Créatures tab, each with its type and a price field', async () => {
      await openHdv('personal');
      expect(rows()).toHaveLength(35);
      expect(within(rowOf(CROQUETTE.name)!).getByText('Nourriture pour familier')).toBeInTheDocument();
      expect(priceInput(CROQUETTE.name)).toHaveValue('');
      await waitFor(() => expect(status()).toBe('0 objet sur 35 a un prix'));
    });

    it('saves a typed price to the carnet of the active mode on blur, with its date', async () => {
      await openHdv('personal');
      typePrice(CROQUETTE.name, '1500');
      await waitFor(async () => expect((await resourcePricesFor('personal').getMany('mikhal', [CROQUETTE.id]))[CROQUETTE.id]?.unitPriceKamas).toBe(1500));
      expect(within(rowOf(CROQUETTE.name)!).getByText(/Dernière mise à jour/)).toBeInTheDocument();
      await waitFor(() => expect(status()).toBe('1 objet sur 35 a un prix'));
    });

    it('reopens the last tab chosen', async () => {
      const view = await openHdv('personal');
      fireEvent.click(screen.getByRole('tab', { name: 'Consommables' }));
      expect(window.localStorage.getItem('craftcheck-hdv-tab')).toBe('consumables');
      view.unmount();
      render(<App />);
      fireEvent.click(await screen.findByRole('link', { name: 'HDV' }));
      expect(await screen.findByRole('tab', { name: 'Consommables' })).toHaveAttribute('aria-selected', 'true');
    });
  });

  // The Consommables tab renders its 128 lines at once in jsdom (no IntersectionObserver): slower
  // than the default 5 s when the whole suite runs in parallel.
  describe('US2 — find an item', { timeout: 30_000 }, () => {
    it('filters by name, whatever the accents or the case', async () => {
      await openHdv('personal', 'consumables');
      fireEvent.change(screen.getByLabelText('Rechercher un objet'), { target: { value: 'BIERE' } });
      await waitFor(() => expect(rows().length).toBeGreaterThan(0));
      expect(names().every((name) => /bi[eè]re/i.test(name))).toBe(true);
    });

    it('filters by type, offering only the types of the tab', async () => {
      await openHdv('personal', 'consumables');
      const select = screen.getByLabelText("Type d'objet") as HTMLSelectElement;
      const options = [...select.options].map((option) => option.textContent);
      expect(options).toContain('Potion');
      expect(options).not.toContain('Nourriture pour familier');
      const potion = [...select.options].find((option) => option.textContent === 'Potion')!;
      fireEvent.change(select, { target: { value: potion.value } });
      await waitFor(() => expect(rows().every((row) => within(row).queryByText('Potion'))).toBe(true));
    });

    it('says so when nothing matches', async () => {
      await openHdv('personal');
      fireEvent.change(screen.getByLabelText('Rechercher un objet'), { target: { value: 'zzzz' } });
      expect(await screen.findByText('Aucun objet ne correspond à votre recherche')).toBeInTheDocument();
    });
  });

  describe('US3 — one price everywhere', () => {
    it('shows a price already in the carnet, and writes to the same carnet as the Recherche page', async () => {
      await resourcePricesFor('community').save('mikhal', CROQUETTE.id, 900);
      await openHdv('community');
      await waitFor(() => expect(priceInput(CROQUETTE.name)).toHaveValue('900'));
      expect((await resourcePricesFor('personal').getMany('mikhal', [CROQUETTE.id]))[CROQUETTE.id]).toBeUndefined();
    });

    it('lets the Familier page use a pet food priced on the HDV page', async () => {
      await openHdv('personal');
      typePrice(CROQUETTE.name, '1500');
      await waitFor(async () => expect((await resourcePricesFor('personal').getMany('mikhal', [CROQUETTE.id]))[CROQUETTE.id]).toBeDefined());
      fireEvent.click(screen.getByRole('link', { name: 'XP Familier' }));
      await screen.findByRole('heading', { name: 'XP Familier' });
      fireEvent.change(screen.getByLabelText('XP totale du familier'), { target: { value: '1703' } });
      fireEvent.change(screen.getByLabelText('Niveau visé'), { target: { value: '60' } });
      await waitFor(() => expect(document.querySelector('li.pet-food-row')?.textContent).toContain(CROQUETTE.name));
    });

    // specs/024-latest-community-price (US3, scenario 3).
    it('in Mode communautaire, shows the latest shared price over an older kept one (specs/024)', async () => {
      await resourcePricesFor('community').save('mikhal', CROQUETTE.id, 900, '2026-09-01T12:00:00.000Z');
      getCommunityPrice.mockResolvedValue({
        status: 'found',
        price: { resourceId: CROQUETTE.id, serverId: 'mikhal', medianAmountKamas: 900, sampleSize: 3, latestAmountKamas: 1200, latestContributionAt: '2026-09-27T12:00:00.000Z' },
      });
      await openHdv('community');
      await waitFor(() => expect(normalize(priceInput(CROQUETTE.name).value)).toBe('1 200'));
    });

    it('in Mode communautaire, behaves like the Recherche field: prefill, lock, history and unusual-price confirmation', async () => {
      getCommunityPrice.mockResolvedValue({
        status: 'found',
        price: { resourceId: CROQUETTE.id, serverId: 'mikhal', medianAmountKamas: 1000, sampleSize: 3, lastContributionAt: new Date().toISOString(), latestAmountKamas: 1000, latestContributionAt: new Date().toISOString() },
      });
      await openHdv('community');
      await waitFor(() => expect(normalize(priceInput(CROQUETTE.name).value)).toBe('1 000'));
      const row = rowOf(CROQUETTE.name)!;
      expect(priceInput(CROQUETTE.name)).toHaveAttribute('readonly');
      expect(within(row).getByRole('button', { name: 'Historique du prix' })).toBeInTheDocument();
      fireEvent.click(within(row).getByRole('button', { name: 'Modifier ce prix' }));
      typePrice(CROQUETTE.name, '9000');
      expect(await screen.findByRole('button', { name: 'Annuler' })).toBeInTheDocument();
    });
  });

  // specs/048-hdv-sort: the « Trier » menu replaces the « Sans prix » / « Prix ancien » filters of specs/023.
  describe('sorting a tab (specs/048)', () => {
    // In the tab's own order (by name): Croquette enrichie, then the two others.
    const ABRAKNYDE = { id: '27006', name: 'Croquette infusée de l\'Abraknyde' };
    const ARAKNE = { id: '27010', name: 'Croquette infusée de l\'Arakne' };
    const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const sortBy = (label: string) => {
      const select = screen.getByRole('combobox', { name: 'Trier' }) as HTMLSelectElement;
      fireEvent.change(select, { target: { value: [...select.options].find((option) => option.textContent === label)!.value } });
    };
    const firstNames = (count: number) => names().slice(0, count).map((name) => name.trim());

    it('sorts by price or by date, the items without a price after the others', async () => {
      const carnet = resourcePricesFor('personal');
      await carnet.save('mikhal', CROQUETTE.id, 300, daysAgo(3));
      await carnet.save('mikhal', ABRAKNYDE.id, 50, daysAgo(1));
      await carnet.save('mikhal', ARAKNE.id, 900, daysAgo(10));
      await openHdv('personal');
      await waitFor(() => expect(status()).toBe('3 objets sur 35 ont un prix'));
      const select = screen.getByRole('combobox', { name: 'Trier' }) as HTMLSelectElement;
      expect([...select.options].map((option) => option.textContent)).toEqual([
        'Tri par nom', 'Prix le plus élevé', 'Prix le plus bas', 'Mis à jour récemment', 'Mis à jour il y a longtemps',
      ]);
      expect(firstNames(3)).toEqual([CROQUETTE.name, ABRAKNYDE.name, ARAKNE.name]);

      sortBy('Prix le plus élevé');
      await waitFor(() => expect(firstNames(3)).toEqual([ARAKNE.name, CROQUETTE.name, ABRAKNYDE.name]));
      sortBy('Prix le plus bas');
      await waitFor(() => expect(firstNames(3)).toEqual([ABRAKNYDE.name, CROQUETTE.name, ARAKNE.name]));
      sortBy('Mis à jour récemment');
      await waitFor(() => expect(firstNames(3)).toEqual([ABRAKNYDE.name, CROQUETTE.name, ARAKNE.name]));
      sortBy('Mis à jour il y a longtemps');
      await waitFor(() => expect(firstNames(3)).toEqual([ARAKNE.name, CROQUETTE.name, ABRAKNYDE.name]));

      // Every item of the tab is still listed, and the count ignores the sort.
      expect(rows()).toHaveLength(35);
      expect(status()).toBe('3 objets sur 35 ont un prix');
      sortBy('Tri par nom');
      await waitFor(() => expect(firstNames(3)).toEqual([CROQUETTE.name, ABRAKNYDE.name, ARAKNE.name]));
    });

    it('sorts what the search keeps, and stays chosen in another tab', async () => {
      const carnet = resourcePricesFor('personal');
      await carnet.save('mikhal', CROQUETTE.id, 300, daysAgo(3));
      await carnet.save('mikhal', ARAKNE.id, 900, daysAgo(10));
      await openHdv('personal');
      await waitFor(() => expect(status()).toBe('2 objets sur 35 ont un prix'));
      sortBy('Prix le plus élevé');
      fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher un objet' }), { target: { value: 'croquette' } });
      await waitFor(() => expect(firstNames(2)).toEqual([ARAKNE.name, CROQUETTE.name]));

      fireEvent.click(screen.getByRole('tab', { name: 'Consommables' }));
      await waitFor(() => expect(screen.getByRole('tab', { name: 'Consommables' })).toHaveAttribute('aria-selected', 'true'));
      expect(screen.getByRole('combobox', { name: 'Trier' })).toHaveValue('price-desc');
    });

    it('no longer offers the price filters it replaces', async () => {
      await openHdv('personal');
      expect(screen.queryByRole('button', { name: 'Sans prix' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Prix ancien' })).not.toBeInTheDocument();
      expect(screen.queryByRole('group', { name: 'Filtrer par prix' })).not.toBeInTheDocument();
    });

    it('shows an icon in each tab, whose name stays its label (US2)', async () => {
      await openHdv('personal');
      const tabs = screen.getAllByRole('tab');
      expect(tabs.map((tab) => tab.textContent)).toEqual(['Ressources', 'Consommables', 'Créatures', 'Runes']);
      for (const tab of tabs) expect(tab.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
      expect(screen.getByRole('tab', { name: 'Créatures' })).toHaveAttribute('aria-selected', 'true');
    });
  });

  // specs/026-hdv-rune-prices: 105 rune lines rendered at once in jsdom — more time under load.
  describe('Runes tab (specs/026)', { timeout: 20_000 }, () => {
    const DO_AIR = { id: '11663', name: 'Rune Do Air' };

    it('is the fourth tab, after Créatures, and lists every rune with a counter', async () => {
      await openHdv('personal', 'runes');
      expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Ressources', 'Consommables', 'Créatures', 'Runes']);
      expect(screen.getByRole('tab', { name: 'Runes' })).toHaveAttribute('aria-selected', 'true');
      await waitFor(() => expect(rows()).toHaveLength(105));
      await waitFor(() => expect(status()).toBe('0 rune sur 105 a un prix'));
    });

    it('searches by name and filters by stat', async () => {
      await openHdv('personal', 'runes');
      fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher une rune' }), { target: { value: 'do air' } });
      await waitFor(() => expect(names().map((name) => name.trim())).toEqual(['Rune Do Air', 'Rune Pa Do Air']));

      fireEvent.change(screen.getByRole('searchbox', { name: 'Rechercher une rune' }), { target: { value: '' } });
      fireEvent.change(screen.getByRole('combobox', { name: 'Stat' }), { target: { value: 'Force' } });
      await waitFor(() => expect(rows().length).toBeGreaterThan(0));
      expect(rows().every((row) => row.textContent?.includes('Force'))).toBe(true);
    });

    it('saves a typed price like the other tabs, and sorts by stat unless asked otherwise (specs/048)', async () => {
      await openHdv('personal', 'runes');
      typePrice(DO_AIR.name, '1587');
      await waitFor(async () => expect((await resourcePricesFor('personal').getMany('mikhal', [DO_AIR.id]))[DO_AIR.id]?.unitPriceKamas).toBe(1587));
      await waitFor(() => expect(status()).toBe('1 rune sur 105 a un prix'));
      const sort = screen.getByRole('combobox', { name: 'Trier' }) as HTMLSelectElement;
      expect(sort.options[0].textContent).toBe('Tri par stat');
      expect(names()[0].trim()).not.toBe(DO_AIR.name);
      fireEvent.change(sort, { target: { value: 'price-desc' } });
      await waitFor(() => expect(names()[0].trim()).toBe(DO_AIR.name));
      expect(rows()).toHaveLength(105);
    });

    const sharedByBot = () => getCommunityPrice.mockImplementation(async (id) => (id === DO_AIR.id
      ? { status: 'found', price: { resourceId: id, serverId: 'mikhal', medianAmountKamas: 1587, sampleSize: 1, latestAmountKamas: 1587, latestContributionAt: new Date().toISOString(), latestOrigin: 'bot' } }
      : { status: 'not-found' }));

    it('shows the origin of the latest shared price in Mode communautaire', async () => {
      sharedByBot();
      await openHdv('community', 'runes');
      await waitFor(() => expect(rowOf(DO_AIR.name)?.textContent).toContain('Bot Discord'));
    });

    it('shows no origin in Mode personnel, where nothing is shared', async () => {
      sharedByBot();
      await openHdv('personal', 'runes');
      await waitFor(() => expect(rows()).toHaveLength(105));
      expect(rowOf(DO_AIR.name)?.textContent).not.toContain('Bot Discord');
    });
  });
});
