import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { CommunityPriceLookup, LatestItemPriceLookup, PriceHistoryLookup } from '../../src/services/community-price-api';
import type { PriceHistory, SharedPrice } from '../../src/domain/price-history';

// specs/017-price-history-chart and specs/018-price-history-windows, contracts/price-history-ui.md.
const { getCommunityPrice, getLatestItemPrice, getPriceHistory } = vi.hoisted(() => ({
  getCommunityPrice: vi.fn<(resourceId: string, serverId: string) => Promise<CommunityPriceLookup>>(),
  getLatestItemPrice: vi.fn<(itemId: string, serverId: string) => Promise<LatestItemPriceLookup>>(),
  getPriceHistory: vi.fn<(kind: 'resource' | 'item', id: string, serverId: string) => Promise<PriceHistoryLookup>>(),
}));

vi.mock('../../src/services/community-price-api', () => ({
  getCommunityPrice: (resourceId: string, serverId: string) => getCommunityPrice(resourceId, serverId),
  getCommunityPrices: async (ids: string[], serverId: string) => {
    const results = await Promise.all(ids.map((id) => getCommunityPrice(id, serverId) as Promise<{ status: string; price?: unknown }>));
    if (results.some((result) => !result || result.status === 'unavailable')) return { status: 'unavailable' };
    return { status: 'found', prices: results.flatMap((result) => (result.status === 'found' ? [result.price] : [])) };
  },
  getLatestItemPrice: (itemId: string, serverId: string) => getLatestItemPrice(itemId, serverId),
  getPriceHistory: (kind: 'resource' | 'item', id: string, serverId: string) => getPriceHistory(kind, id, serverId),
  submitCommunityPrice: vi.fn().mockResolvedValue({ id: 'c1' }),
}));

vi.mock('../../src/data/catalogue-repository', () => ({
  getCategories: vi.fn().mockResolvedValue([{ id: 'cat-1', label: 'Épées', sortOrder: 1, kind: 'Equipment', typeIds: [] }]),
  searchItems: vi.fn().mockResolvedValue({
    data: [{ id: 'item-1', name: 'Épée Boueuse', level: 1, kind: 'Equipment', categoryId: 'cat-1' }],
    total: 1,
  }),
  getItemDetail: vi.fn().mockResolvedValue({
    recipe: {
      id: 'recipe-1',
      itemId: 'item-1',
      ingredients: [{ resourceId: 'resource-1', quantity: 1 }, { resourceId: 'resource-2', quantity: 2 }],
    },
    resources: [{ id: 'resource-1', name: 'Bois' }, { id: 'resource-2', name: 'Fer' }],
    stats: [],
  }),
  preloadCatalogueIndexes: vi.fn(),
  whenCatalogueReady: vi.fn().mockResolvedValue(undefined),
  getManifest: vi.fn().mockReturnValue({ sourceName: 'test', sourceVersion: '1', catalogueVersion: '1', publishedAt: new Date().toISOString() }),
}));

vi.mock('../../src/data/servers-repository', () => ({
  getServers: vi.fn().mockResolvedValue([
    { id: 'mikhal', name: 'Mikhal', type: 'mono' },
    { id: 'dakal', name: 'Dakal', type: 'mono' },
  ]),
}));

import App from '../../src/app/App';
import { clearPriceHistoryCache } from '../../src/features/comparison/usePriceHistory';

// Prices shared `hoursAgo` hours before now, since the chart spans the window up to the load time.
const price = (hoursAgo: number, amountKamas = 1000): SharedPrice =>
  ({ amountKamas, sharedAt: new Date(Date.now() - hoursAgo * 3_600_000).toISOString() });
const HISTORY: PriceHistory = {
  day: [price(5), price(3), price(2), price(1)],
  week: [price(100), price(50), price(1)],
  month: [price(400), price(1)],
};

async function openSearch(mode: 'community' | 'personal' = 'community') {
  window.localStorage.setItem('craftcheck-price-mode-choice', mode);
  window.localStorage.setItem('craftcheck-search-tour-seen', '1');
  render(<App />);
  fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
  await screen.findAllByPlaceholderText('Prix unitaire');
  // Resource names arrive with the recipe, after the lines themselves.
  await waitFor(() => expect(document.querySelector('.price-line')?.textContent).toContain('Bois'));
}

function resourceHistoryButton(name: string) {
  const line = [...document.querySelectorAll<HTMLElement>('.price-line')].find((candidate) => candidate.textContent?.includes(name));
  if (!line) throw new Error(`No price line for ${name}`);
  return within(line).getByRole('button', { name: 'Historique du prix' });
}

function itemHistoryButton() {
  return within(document.querySelector('.item-detail-card') as HTMLElement).getByRole('button', { name: 'Historique du prix' });
}

describe('price history popover (specs/017)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    globalThis.indexedDB = new IDBFactory();
    clearPriceHistoryCache();
    getCommunityPrice.mockReset().mockResolvedValue({ status: 'not-found' });
    getLatestItemPrice.mockReset().mockResolvedValue({
      status: 'found',
      price: { itemId: 'item-1', serverId: 'mikhal', amountKamas: 6000, contributedAt: '2026-09-24T10:00:00.000Z' },
    });
    getPriceHistory.mockReset().mockResolvedValue({ status: 'found', history: HISTORY });
  });

  afterEach(() => {
    // Unmount first: a still-mounted app would keep its popover's document listeners alive.
    cleanup();
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  describe('US1 — resource history', () => {
    it('shows a history button on every resource line and on the HDV price in Mode communautaire', async () => {
      await openSearch();
      expect(resourceHistoryButton('Bois')).toBeInTheDocument();
      expect(resourceHistoryButton('Fer')).toBeInTheDocument();
      expect(itemHistoryButton()).toBeInTheDocument();
    });

    it('shows no history button in Mode personnel (FR-001)', async () => {
      await openSearch('personal');
      expect(screen.queryByRole('button', { name: 'Historique du prix' })).not.toBeInTheDocument();
    });

    it('opens the weekly curve of the resource without focusing its price field', async () => {
      await openSearch();
      const trigger = resourceHistoryButton('Bois');
      fireEvent.click(trigger);
      const dialog = await screen.findByRole('dialog', { name: 'Historique du prix de Bois' });
      expect(getPriceHistory).toHaveBeenCalledWith('resource', 'resource-1', 'mikhal');
      await waitFor(() => expect(dialog.querySelectorAll('.price-history-point')).toHaveLength(3));
      expect(document.activeElement?.getAttribute('placeholder')).not.toBe('Prix unitaire');
      expect(within(dialog).getByText('Serveur Mikhal')).toBeInTheDocument();
    });

    it('closes on Escape and « Fermer », giving focus back to the trigger, and on an outside click', async () => {
      await openSearch();
      const trigger = resourceHistoryButton('Bois');

      fireEvent.click(trigger);
      await screen.findByRole('dialog');
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();

      fireEvent.click(trigger);
      fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Fermer' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();

      fireEvent.click(trigger);
      await screen.findByRole('dialog');
      fireEvent.pointerDown(document.body);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('keeps one popover open at a time, and scrolling does not close it', async () => {
      await openSearch();
      fireEvent.click(resourceHistoryButton('Bois'));
      await screen.findByRole('dialog', { name: 'Historique du prix de Bois' });
      fireEvent.scroll(window);
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      const other = resourceHistoryButton('Fer');
      fireEvent.pointerDown(other);
      fireEvent.click(other);
      await screen.findByRole('dialog', { name: 'Historique du prix de Fer' });
      expect(screen.getAllByRole('dialog')).toHaveLength(1);
    });

    it('closes when the active server changes', async () => {
      await openSearch();
      fireEvent.click(resourceHistoryButton('Bois'));
      await screen.findByRole('dialog', { name: 'Historique du prix de Bois' });
      const switcher = screen.getByRole('button', { name: /Serveur actif/ });
      fireEvent.pointerDown(switcher);
      fireEvent.click(switcher);
      fireEvent.click(screen.getByRole('option', { name: 'Dakal' }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: /Historique du prix/ })).not.toBeInTheDocument());
    });

    it('changes neither the price field nor the comparison (FR-014)', async () => {
      await openSearch();
      const craftCost = () => screen.getByText(/Coût de craft/).textContent;
      const hdv = screen.getByLabelText('Prix HDV');
      await waitFor(() => expect(hdv).toHaveValue('6 000'));
      const before = craftCost();
      fireEvent.click(resourceHistoryButton('Bois'));
      await screen.findByRole('dialog');
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(craftCost()).toBe(before);
      expect(hdv).toHaveValue('6 000');
    });
  });

  describe('US2 — window', () => {
    it('starts on the week, redraws per window without a new request, and remembers the choice', async () => {
      await openSearch();
      fireEvent.click(resourceHistoryButton('Bois'));
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByRole('button', { name: 'Semaine' })).toHaveAttribute('aria-pressed', 'true');
      await waitFor(() => expect(dialog.querySelectorAll('.price-history-point')).toHaveLength(3));

      fireEvent.click(within(dialog).getByRole('button', { name: 'Jour' }));
      expect(dialog.querySelectorAll('.price-history-point')).toHaveLength(4);
      fireEvent.click(within(dialog).getByRole('button', { name: 'Mois' }));
      expect(dialog.querySelectorAll('.price-history-point')).toHaveLength(2);
      expect(getPriceHistory).toHaveBeenCalledTimes(1);

      fireEvent.keyDown(document, { key: 'Escape' });
      fireEvent.click(resourceHistoryButton('Fer'));
      const next = await screen.findByRole('dialog', { name: 'Historique du prix de Fer' });
      expect(within(next).getByRole('button', { name: 'Mois' })).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('US3 — item history', () => {
    it("opens the item's HDV price history from the item card, leaving the field locked and unchanged", async () => {
      await openSearch();
      const hdv = screen.getByLabelText('Prix HDV');
      await waitFor(() => expect(hdv).toHaveValue('6 000'));
      fireEvent.click(itemHistoryButton());
      await screen.findByRole('dialog', { name: 'Historique du prix de Épée Boueuse' });
      expect(getPriceHistory).toHaveBeenCalledWith('item', 'item-1', 'mikhal');
      expect(hdv).toHaveAttribute('readonly');
      expect(hdv).not.toHaveFocus();
      expect(hdv).toHaveValue('6 000');
    });
  });

  describe('US4 — thin history', () => {
    it('says there is no history yet, without a curve', async () => {
      getPriceHistory.mockResolvedValue({ status: 'found', history: { day: [], week: [], month: [] } });
      await openSearch();
      fireEvent.click(resourceHistoryButton('Bois'));
      const dialog = await screen.findByRole('dialog');
      expect(await within(dialog).findByText("Pas encore d'historique pour ce serveur.")).toBeInTheDocument();
      expect(dialog.querySelector('.price-history-svg')).toBeNull();
    });

    it('says no price was shared in the window and offers a longer one (specs/018 FR-007)', async () => {
      getPriceHistory.mockResolvedValue({ status: 'found', history: { day: [], week: [price(50), price(30)], month: [price(50), price(30)] } });
      await openSearch();
      window.localStorage.setItem('craftcheck-history-grouping', 'day');
      fireEvent.click(resourceHistoryButton('Bois'));
      const dialog = await screen.findByRole('dialog');
      expect(await within(dialog).findByText('Aucun prix partagé sur cette période.')).toBeInTheDocument();
      fireEvent.click(within(dialog).getByRole('button', { name: 'Voir Semaine' }));
      expect(within(dialog).getByRole('button', { name: 'Semaine' })).toHaveAttribute('aria-pressed', 'true');
      expect(dialog.querySelectorAll('.price-history-point')).toHaveLength(2);
    });

    it('shows a single price with its date and time, without a curve', async () => {
      getPriceHistory.mockResolvedValue({ status: 'found', history: { day: [], week: [price(30, 1200)], month: [price(30, 1200)] } });
      await openSearch();
      fireEvent.click(resourceHistoryButton('Bois'));
      const dialog = await screen.findByRole('dialog');
      expect(await within(dialog).findByText('1 200 kamas')).toBeInTheDocument();
      expect(within(dialog).getByText(/^le .+ à \d\d:\d\d$/)).toBeInTheDocument();
      expect(dialog.querySelector('.price-history-svg')).toBeNull();
      expect(within(dialog).queryByRole('button', { name: /^Voir / })).not.toBeInTheDocument();
    });

    it('says the history is unavailable when the service cannot be reached (FR-013)', async () => {
      getPriceHistory.mockResolvedValue({ status: 'unavailable' });
      await openSearch();
      fireEvent.click(resourceHistoryButton('Bois'));
      const dialog = await screen.findByRole('dialog');
      expect(await within(dialog).findByText('Historique indisponible pour le moment.')).toBeInTheDocument();
      expect(dialog.querySelector('.price-history-svg')).toBeNull();
    });
  });
});
