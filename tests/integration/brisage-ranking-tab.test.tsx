import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

// specs/072-classement-brisage. Real rune data: Rune Vi 1523, Rune Cha 1525, Rune Do 7435, Rune Ga Pa 1557 (stat PA).
const getSharedItemPrices = vi.fn();
const getCommunityPrices = vi.fn();
vi.mock('../../src/services/community-price-api', () => ({
  getCommunityPrice: vi.fn().mockResolvedValue({ status: 'not-found' }),
  getCommunityPrices: (...args: unknown[]) => getCommunityPrices(...args),
  getSharedItemPrices: (...args: unknown[]) => getSharedItemPrices(...args),
  submitCommunityPrice: vi.fn().mockResolvedValue(undefined),
  getLatestItemPrice: vi.fn().mockResolvedValue({ status: 'not-found' }),
}));

const getSiteSettings = vi.fn();
vi.mock('../../src/services/site-settings-api', () => ({
  getSiteSettings: (...args: unknown[]) => getSiteSettings(...args),
}));

const getSharedCoefficients = vi.fn();
vi.mock('../../src/services/brisage-coefficient-api', () => ({
  MAX_ITEMS_PER_READ: 96,
  MAX_ENTRIES_PER_SEND: 100,
  getSharedCoefficients: (...args: unknown[]) => getSharedCoefficients(...args),
  submitCoefficients: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../src/data/catalogue-repository', () => ({
  getCategories: vi.fn().mockResolvedValue([
    { id: 'equipment-type-17', label: 'Capes', sortOrder: 1, kind: 'Equipment', typeIds: [17] },
    { id: 'equipment-type-9', label: 'Anneaux', sortOrder: 2, kind: 'Equipment', typeIds: [9] },
  ]),
  searchItems: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getItemDetail: vi.fn().mockResolvedValue({ recipe: undefined, resources: [] }),
  getItemEffectRanges: vi.fn().mockResolvedValue([{ effectId: 125, from: 40, to: 44 }, { effectId: 123, from: 38, to: 38 }]),
  getItemNegativeRanges: vi.fn().mockResolvedValue([]),
  getResourceRecipe: vi.fn().mockResolvedValue(null),
  getResourceDetails: vi.fn().mockResolvedValue([]),
  preloadCatalogueIndexes: vi.fn(),
  whenCatalogueReady: vi.fn().mockResolvedValue(undefined),
  getManifest: vi.fn().mockReturnValue({ sourceName: 'test', sourceVersion: '1', catalogueVersion: '1', publishedAt: new Date().toISOString() }),
}));

vi.mock('../../src/data/brisage-items-repository', () => ({
  loadBrisageItemsIndex: vi.fn().mockResolvedValue({
    source: 'test', sourceUrl: 'https://example.test', retrievedAt: '2026-10-20',
    items: [
      { id: '777', name: 'Cape du Chef Bwork', level: 100, categoryId: 'equipment-type-17', effects: [{ effectId: 125, from: 40, to: 44 }, { effectId: 123, from: 38, to: 38 }] },
      { id: '888', name: 'Anneau du Sage', level: 60, categoryId: 'equipment-type-9', effects: [{ effectId: 112, from: 1, to: 9 }] },
      { id: '555', name: 'Chapeau sans prix', level: 30, categoryId: 'equipment-type-17', effects: [{ effectId: 125, from: 10, to: 12 }] },
    ],
  }),
}));

vi.mock('../../src/data/servers-repository', () => ({
  getServers: vi.fn().mockResolvedValue([{ id: 'mikhal', name: 'Mikhal', type: 'mono' }]),
}));

import App from '../../src/app/App';
import { pinnedItemPrices } from '../../src/persistence/indexeddb-pinned-item-price-repository';
import { forgetSharedCoefficients } from '../../src/features/brisage/use-shared-coefficients';
import { resourcePricesFor } from '../../src/persistence/resource-prices-for-mode';

const COEFFICIENTS_KEY = 'craftcheck-brisage-coefficients';
const DAY = 24 * 60 * 60 * 1000;

async function openBrisage(path = '/brisage', mode = 'personal') {
  window.localStorage.setItem('craftcheck-price-mode-choice', mode);
  window.localStorage.setItem('craftcheck-search-tour-seen', '1');
  window.history.pushState({}, '', path);
  render(<App />);
  // A first visit asks for the server; a returning visitor (server already chosen) goes straight to the page.
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Mikhal' }) ?? screen.queryByRole('heading', { name: 'Brisage' })).toBeTruthy());
  const server = screen.queryByRole('button', { name: 'Mikhal' });
  if (server) fireEvent.click(server);
  await screen.findByRole('heading', { name: 'Brisage' });
}

async function openRanking() {
  await openBrisage('/brisage?classement=1');
  fireEvent.click(await screen.findByRole('tab', { name: 'Classement' }));
  await screen.findByRole('table');
}

const rowNames = () => [...document.querySelectorAll('.ranking-row')].map((row) => within(row as HTMLElement).getByRole('button').textContent);
const rowOf = (name: string) => screen.getByRole('button', { name }).closest('tr') as HTMLTableRowElement;

async function pricesKnown() {
  const carnet = resourcePricesFor('personal');
  await carnet.save('mikhal', '1523', 5);
  await carnet.save('mikhal', '1525', 5);
  await carnet.save('mikhal', '7435', 3000);
  await pinnedItemPrices.save('mikhal', '777', 800);
  await pinnedItemPrices.save('mikhal', '888', 5000);
}

function noteCoefficient(itemId: string, coefficient: number, savedAt = new Date().toISOString()) {
  const known = JSON.parse(window.localStorage.getItem(COEFFICIENTS_KEY) ?? '{}') as Record<string, unknown>;
  window.localStorage.setItem(COEFFICIENTS_KEY, JSON.stringify({ ...known, [`mikhal:${itemId}`]: { coefficient, savedAt } }));
}

beforeAll(async () => { await import('../../src/features/brisage/BrisagePage'); });

describe('Brisage ranking tab (specs/072)', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    globalThis.indexedDB = new IDBFactory();
    forgetSharedCoefficients();
    getSiteSettings.mockReset();
    getSiteSettings.mockResolvedValue(undefined);
    getSharedCoefficients.mockReset();
    getSharedCoefficients.mockResolvedValue(new Map());
    getSharedItemPrices.mockReset();
    getSharedItemPrices.mockResolvedValue({ status: 'found', items: [] });
    getCommunityPrices.mockReset();
    getCommunityPrices.mockResolvedValue({ status: 'found', prices: [] });
    await pricesKnown();
  });
  afterEach(() => cleanup());

  describe('access (US6)', () => {
    it('shows no tab and reads nothing for a visitor who did not turn it on', async () => {
      await openBrisage();
      expect(screen.queryByRole('tab')).not.toBeInTheDocument();
      expect(screen.queryByText('Classement')).not.toBeInTheDocument();
      expect(getSharedCoefficients).not.toHaveBeenCalled();
      expect(getSharedItemPrices).not.toHaveBeenCalled();
    });

    // specs/072 (T037): the owner opens the tab to everyone from the administration page.
    it('shows the tab to a visitor when the shared setting is on', async () => {
      const { DEFAULT_SITE_SETTINGS } = await import('../../src/domain/site-settings');
      getSiteSettings.mockResolvedValue({ ...DEFAULT_SITE_SETTINGS, brisageRanking: true });
      await openBrisage();
      expect(await screen.findByRole('tab', { name: 'Classement' })).toBeInTheDocument();
    });

    it('keeps the tab hidden when the shared setting is off', async () => {
      const { DEFAULT_SITE_SETTINGS } = await import('../../src/domain/site-settings');
      getSiteSettings.mockResolvedValue({ ...DEFAULT_SITE_SETTINGS, brisageRanking: false });
      await openBrisage();
      expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    });

    it('opens with ?classement=1, takes the parameter off the address and keeps the access after a reload', async () => {
      await openBrisage('/brisage?classement=1');
      expect(await screen.findByRole('tab', { name: 'Classement' })).toBeInTheDocument();
      expect(window.location.search).toBe('');
      cleanup();
      await openBrisage('/brisage');
      expect(await screen.findByRole('tab', { name: 'Classement' })).toBeInTheDocument();
    });

    it('is taken away by ?classement=0', async () => {
      await openBrisage('/brisage?classement=1');
      cleanup();
      await openBrisage('/brisage?classement=0');
      expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    });

    it('opens on the item page, not on the ranking', async () => {
      await openBrisage('/brisage?classement=1');
      expect(await screen.findByRole('tab', { name: 'Fiche' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });
  });

  describe('ranking (US1, US7)', () => {
    it('lists the items with a price, the known coefficients first by gain, then the unknown ones by threshold', async () => {
      noteCoefficient('777', 38);
      await openRanking();
      expect(screen.getByRole('rowgroup', { name: 'Coefficient connu' })).toBeInTheDocument();
      expect(screen.getByRole('rowgroup', { name: 'Coefficient inconnu' })).toBeInTheDocument();
      expect(rowNames()).toEqual(['Cape du Chef Bwork', 'Anneau du Sage']);
      expect(within(rowOf('Cape du Chef Bwork')).getByText(/38 %/)).toBeInTheDocument();
      // No gain in kamas for an unknown coefficient.
      const unknown = within(rowOf('Anneau du Sage'));
      expect(unknown.getByText('coefficient inconnu')).toBeInTheDocument();
      expect(unknown.getByText(/%|jamais rentable/)).toBeInTheDocument();
    });

    it('does not list an item without a price by default, and does when the option is unchecked', async () => {
      await openRanking();
      expect(rowNames()).not.toContain('Chapeau sans prix');
      fireEvent.click(screen.getByLabelText('Masquer les objets sans prix'));
      expect(rowNames()).toContain('Chapeau sans prix');
      expect(within(rowOf('Chapeau sans prix')).getByText("Prix de l'objet inconnu")).toBeInTheDocument();
    });

    it('uses the prices of the active mode (FR-013)', async () => {
      cleanup();
      getSharedItemPrices.mockResolvedValue({ status: 'found', items: [{ itemId: '888', amountKamas: 5000, contributedAt: new Date().toISOString() }] });
      await resourcePricesFor('community').save('mikhal', '7435', 3000);
      await openBrisage('/brisage?classement=1', 'community');
      fireEvent.click(await screen.findByRole('tab', { name: 'Classement' }));
      await screen.findByRole('table');
      expect(rowNames()).toEqual(['Anneau du Sage']);
      expect(within(rowOf('Anneau du Sage')).getByText(/communautaire/)).toBeInTheDocument();
    });

    it('says so when no item has a price', async () => {
      globalThis.indexedDB = new IDBFactory();
      await openBrisage('/brisage?classement=1');
      fireEvent.click(await screen.findByRole('tab', { name: 'Classement' }));
      expect(await screen.findByText(/Aucun prix d'objet connu/)).toBeInTheDocument();
    });

    it('draws 100 rows per group and shows more on demand (SC-003)', async () => {
      const { loadBrisageItemsIndex } = await import('../../src/data/brisage-items-repository');
      const original = await loadBrisageItemsIndex();
      const many = Array.from({ length: 130 }, (_, i) => ({ id: `m${i}`, name: `Objet ${String(i).padStart(3, '0')}`, level: 1 + i, effects: [{ effectId: 125, from: 10, to: 12 }] }));
      vi.mocked(loadBrisageItemsIndex).mockResolvedValue({ ...original, items: many });
      for (const item of many) await pinnedItemPrices.save('mikhal', item.id, 100);
      try {
        await openRanking();
        expect(rowNames().length).toBe(100);
        fireEvent.click(screen.getByRole('button', { name: /Afficher plus/ }));
        expect(rowNames().length).toBe(130);
        expect(screen.queryByRole('button', { name: /Afficher plus/ })).not.toBeInTheDocument();
      } finally {
        vi.mocked(loadBrisageItemsIndex).mockResolvedValue(original);
      }
    });

    it('flags an incomplete ranking when the shared coefficients cannot be read, and still lists the items', async () => {
      getSharedCoefficients.mockResolvedValue(undefined);
      await openRanking();
      expect(await screen.findByText(/Classement incomplet : coefficients partagés/)).toBeInTheDocument();
      expect(rowNames().length).toBe(2);
    });

    it('takes a more recent shared coefficient over an older one noted here', async () => {
      noteCoefficient('777', 38, new Date(Date.now() - 5 * DAY).toISOString());
      getSharedCoefficients.mockResolvedValue(new Map([['777', { coefficient: 61, savedAt: new Date().toISOString() }]]));
      await openRanking();
      await waitFor(() => expect(within(rowOf('Cape du Chef Bwork')).getByText(/61 %/)).toBeInTheDocument());
    });
  });

  describe('freshness (US3)', () => {
    it('shows the age of the coefficient and marks a stale one', async () => {
      noteCoefficient('777', 38, new Date(Date.now() - 10 * DAY).toISOString());
      await openRanking();
      const cell = within(rowOf('Cape du Chef Bwork')).getByText(/38 %/).closest('td') as HTMLElement;
      expect(within(cell).getByText(/il y a 10 j \(périmé\)/)).toBeInTheDocument();
    });

    it('shows a fresh coefficient without the stale mark', async () => {
      noteCoefficient('777', 38);
      await openRanking();
      const cell = within(rowOf('Cape du Chef Bwork')).getByText(/38 %/).closest('td') as HTMLElement;
      expect(within(cell).getByText("aujourd'hui")).toBeInTheDocument();
      expect(within(cell).queryByText(/périmé/)).not.toBeInTheDocument();
    });
  });

  describe('sort (US2)', () => {
    it('sorts a column and reverses it on a second click, with aria-sort', async () => {
      noteCoefficient('777', 38);
      noteCoefficient('888', 50);
      await openRanking();
      const level = screen.getByRole('button', { name: /^Niveau/ });
      fireEvent.click(level);
      expect(rowNames()).toEqual(['Cape du Chef Bwork', 'Anneau du Sage']);
      expect(level.closest('th')).toHaveAttribute('aria-sort', 'descending');
      fireEvent.click(level);
      expect(rowNames()).toEqual(['Anneau du Sage', 'Cape du Chef Bwork']);
      expect(level.closest('th')).toHaveAttribute('aria-sort', 'ascending');
    });

    it('keeps the sort when a filter changes', async () => {
      noteCoefficient('777', 38);
      noteCoefficient('888', 50);
      await openRanking();
      fireEvent.click(screen.getByRole('button', { name: /^Niveau/ }));
      fireEvent.click(screen.getByRole('button', { name: /^Niveau/ }));
      fireEvent.change(screen.getByLabelText('Niveau maximum'), { target: { value: '200' } });
      expect(rowNames()).toEqual(['Anneau du Sage', 'Cape du Chef Bwork']);
    });
  });

  describe('filters (US4)', () => {
    it('filters by level, category and minimum gain, and hides the items without coefficient', async () => {
      noteCoefficient('777', 38);
      await openRanking();
      fireEvent.change(screen.getByLabelText('Niveau minimum'), { target: { value: '80' } });
      expect(rowNames()).toEqual(['Cape du Chef Bwork']);
      fireEvent.change(screen.getByLabelText('Niveau minimum'), { target: { value: '' } });
      fireEvent.change(screen.getByLabelText('Catégorie'), { target: { value: 'equipment-type-9' } });
      expect(rowNames()).toEqual(['Anneau du Sage']);
      fireEvent.change(screen.getByLabelText('Catégorie'), { target: { value: '' } });
      fireEvent.click(screen.getByLabelText('Masquer les objets sans coefficient'));
      expect(rowNames()).toEqual(['Cape du Chef Bwork']);
      fireEvent.change(screen.getByLabelText('Gain minimum (kamas)'), { target: { value: '999999999' } });
      expect(rowNames()).toEqual([]);
      expect(screen.getByText('Aucun objet ne correspond à ces filtres.')).toBeInTheDocument();
    });

    it('resets the filters', async () => {
      noteCoefficient('777', 38);
      await openRanking();
      fireEvent.change(screen.getByLabelText('Niveau maximum'), { target: { value: '5' } });
      expect(rowNames()).toEqual([]);
      fireEvent.click(screen.getAllByRole('button', { name: 'Réinitialiser les filtres' })[0]);
      expect(rowNames().length).toBe(2);
    });

    it('warns and does not filter when the minimum level is above the maximum', async () => {
      await openRanking();
      fireEvent.change(screen.getByLabelText('Niveau minimum'), { target: { value: '90' } });
      fireEvent.change(screen.getByLabelText('Niveau maximum'), { target: { value: '70' } });
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(rowNames().length).toBe(2);
    });
  });

  describe('opening an item (US5)', () => {
    it('opens the item on the item page and finds the sort and filters again on the way back', async () => {
      noteCoefficient('777', 38);
      await openRanking();
      fireEvent.change(screen.getByLabelText('Niveau minimum'), { target: { value: '50' } });
      fireEvent.click(screen.getByRole('button', { name: /^Niveau/ }));
      fireEvent.click(rowOf('Cape du Chef Bwork'));
      expect(await screen.findByRole('tab', { name: 'Fiche' })).toHaveAttribute('aria-selected', 'true');
      expect(await screen.findByRole('region', { name: 'Objet à briser' })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('tab', { name: 'Classement' }));
      await screen.findByRole('table');
      expect(screen.getByLabelText('Niveau minimum')).toHaveValue(50);
      expect(screen.getByRole('button', { name: /^Niveau/ }).closest('th')).toHaveAttribute('aria-sort', 'descending');
    });

    it('opens the item with Enter on a row', async () => {
      noteCoefficient('777', 38);
      await openRanking();
      fireEvent.keyDown(rowOf('Cape du Chef Bwork'), { key: 'Enter' });
      expect(await screen.findByRole('tab', { name: 'Fiche' })).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('exo (US8)', () => {
    it('gives the best exo with the rune taken off the gain, for a known coefficient', async () => {
      noteCoefficient('777', 100);
      await resourcePricesFor('personal').save('mikhal', '1557', 5000);
      await openRanking();
      const cell = (await within(rowOf('Cape du Chef Bwork')).findByText('PA', { selector: 'strong' })).closest('td') as HTMLElement;
      expect(cell.textContent).toMatch(/PA : [+−]?[\d\s\u202f\u00a0]+/);
      expect(cell.textContent).toMatch(/\(\+/);
      expect(screen.getByText(/une rune déduite/)).toBeInTheDocument();
    });

    it('gives a threshold, never a gain, for an unknown coefficient', async () => {
      await resourcePricesFor('personal').save('mikhal', '1557', 5000);
      await openRanking();
      // The cape has no coefficient noted: its Rune Vi / Cha are cheap, so a costly rune of PA lowers the threshold a lot.
      const row = within(rowOf('Cape du Chef Bwork'));
      expect(row.getByText('coefficient inconnu')).toBeInTheDocument();
      const cell = (await row.findByText('PA', { selector: 'strong' })).closest('td') as HTMLElement;
      expect(cell.textContent).toMatch(/PA : [\d,]+ %/);
      expect(cell.querySelector('.kamas-amount')).toBeNull();
    });

    it('shows nothing for an item whose exo would not pay', async () => {
      noteCoefficient('777', 38);
      await resourcePricesFor('personal').save('mikhal', '1557', 5000);
      await openRanking();
      await waitFor(() => expect(within(rowOf('Cape du Chef Bwork')).queryByText('calcul…')).not.toBeInTheDocument());
      expect(within(rowOf('Cape du Chef Bwork')).queryByText('PA', { selector: 'strong' })).not.toBeInTheDocument();
    });
  });
});
