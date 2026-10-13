import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { CommunityPriceLookup } from '../../src/services/community-price-api';
import type { RecipeRefreshOutcome } from '../../src/domain/recipe-refresh';
import type { CommunityPrice } from '../../src/domain/types';

// specs/047-recherche-refresh-prices: the Recherche page's « Actualiser les prix » button, and the
// mention of a fragile Huzounet price on a resource line.
const getCommunityPrice = vi.fn<(resourceId: string, serverId: string) => Promise<CommunityPriceLookup>>();
const getLatestItemPrice = vi.fn();
const refreshRecipePrices = vi.fn<(serverId: string, itemId: string, ids: string[]) => Promise<RecipeRefreshOutcome>>();
const submitCommunityPrice = vi.fn();

vi.mock('../../src/services/community-price-api', () => ({
  getCommunityPrice: (resourceId: string, serverId: string) => getCommunityPrice(resourceId, serverId),
  getCommunityPrices: async (ids: string[], serverId: string) => {
    const results = await Promise.all(ids.map((id) => getCommunityPrice(id, serverId)));
    if (results.some((result) => !result || result.status === 'unavailable')) return { status: 'unavailable' };
    return { status: 'found', prices: results.flatMap((result) => (result.status === 'found' ? [result.price] : [])) };
  },
  submitCommunityPrice: (...args: unknown[]) => submitCommunityPrice(...args),
  getLatestItemPrice: (...args: unknown[]) => getLatestItemPrice(...args),
  refreshRecipePrices: (serverId: string, itemId: string, ids: string[]) => refreshRecipePrices(serverId, itemId, ids),
}));

// Numeric ids, like the real catalogue's: the only ones the API reads again.
const ITEMS = [
  { id: '14076', name: 'Épée Boueuse', level: 1, kind: 'Equipment', categoryId: 'cat-1' },
  { id: '14077', name: 'Dague Boueuse', level: 1, kind: 'Equipment', categoryId: 'cat-1' },
];

vi.mock('../../src/data/catalogue-repository', () => ({
  getCategories: vi.fn().mockResolvedValue([{ id: 'cat-1', label: 'Épées', sortOrder: 1, kind: 'Equipment', typeIds: [] }]),
  searchItems: vi.fn().mockImplementation(async () => ({ data: ITEMS, total: ITEMS.length })),
  getItemDetail: vi.fn().mockImplementation(async (itemId: string) => ({
    recipe: { id: `recipe-${itemId}`, itemId, ingredients: [{ resourceId: '303', quantity: 2 }] },
    resources: [{ id: '303', name: 'Bois' }],
    stats: [],
  })),
  preloadCatalogueIndexes: vi.fn(),
  whenCatalogueReady: vi.fn().mockResolvedValue(undefined),
  getManifest: vi.fn().mockReturnValue({ sourceName: 'test', sourceVersion: '1', catalogueVersion: '1', publishedAt: new Date().toISOString() }),
}));

vi.mock('../../src/data/servers-repository', () => ({
  getServers: vi.fn().mockResolvedValue([{ id: 'mikhal', name: 'Mikhal', type: 'mono' }]),
}));

import App from '../../src/app/App';

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

function price(amountKamas: number, contributedAt: string, extra: Partial<CommunityPrice> = {}): CommunityPriceLookup {
  return {
    status: 'found',
    price: {
      resourceId: '303', serverId: 'mikhal', medianAmountKamas: amountKamas, sampleSize: 3,
      latestAmountKamas: amountKamas, latestContributionAt: contributedAt, ...extra,
    },
  };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

// `again`: a second visit, where the server chosen on the first one is remembered.
async function openRecherche(mode: 'community' | 'personal' = 'community', again = false) {
  window.localStorage.setItem('craftcheck-price-mode-choice', mode);
  const view = render(<App />);
  if (!again) fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
  await screen.findByRole('heading', { name: 'Prix des ressources' });
  return view;
}

const refreshButton = () => screen.getByRole('button', { name: /Actualiser les prix|Actualisation…/ });
const priceField = () => screen.getByPlaceholderText('Prix unitaire');

describe('bouton « Actualiser les prix » de la page Recherche (specs/047-recherche-refresh-prices)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('craftcheck-search-tour-seen', '1');
    globalThis.indexedDB = new IDBFactory();
    getCommunityPrice.mockReset();
    getCommunityPrice.mockResolvedValue(price(120, minutesAgo(180)));
    getLatestItemPrice.mockReset();
    getLatestItemPrice.mockResolvedValue({ status: 'not-found' });
    refreshRecipePrices.mockReset();
    submitCommunityPrice.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('is not offered in Mode personnel (FR-001)', async () => {
    await openRecherche('personal');
    expect(screen.queryByRole('button', { name: 'Actualiser les prix' })).not.toBeInTheDocument();
  });

  it('asks once for the item and the resources of its recipe, and shows the prices read again (US1)', async () => {
    await openRecherche();
    await waitFor(() => expect(priceField()).toHaveValue('120'));
    const itemReads = getLatestItemPrice.mock.calls.length;
    const request = deferred<RecipeRefreshOutcome>();
    refreshRecipePrices.mockReturnValue(request.promise);

    fireEvent.click(refreshButton());

    expect(refreshRecipePrices).toHaveBeenCalledTimes(1);
    expect(refreshRecipePrices).toHaveBeenCalledWith('mikhal', '14076', ['14076', '303']);
    // While the API is reading: no second request possible, and the button says so.
    await waitFor(() => expect(refreshButton()).toBeDisabled());
    expect(refreshButton()).toHaveTextContent('Actualisation…');

    getCommunityPrice.mockResolvedValue(price(500, minutesAgo(0), { latestOrigin: 'external' }));
    request.resolve({ status: 'ok', refreshed: 2 });

    expect(await screen.findByRole('status')).toHaveTextContent('Prix actualisés.');
    await waitFor(() => expect(priceField()).toHaveValue('500'));
    expect(refreshButton()).toBeEnabled();
    expect(refreshButton()).toHaveTextContent('Actualiser les prix');
    // The item's own shared HDV price is read again too (FR-004).
    await waitFor(() => expect(getLatestItemPrice.mock.calls.length).toBeGreaterThan(itemReads));
    expect(refreshRecipePrices).toHaveBeenCalledTimes(1);
    // Reading again shares nothing in the player's name (FR-007).
    expect(submitCommunityPrice).not.toHaveBeenCalled();
  });

  it('says so when every price was already up to date (US1)', async () => {
    await openRecherche();
    refreshRecipePrices.mockResolvedValue({ status: 'ok', refreshed: 0 });
    fireEvent.click(refreshButton());
    expect(await screen.findByRole('status')).toHaveTextContent('Les prix sont déjà à jour.');
  });

  it('never replaces a price being typed (FR-007)', async () => {
    await openRecherche();
    await waitFor(() => expect(priceField()).toHaveValue('120'));
    fireEvent.change(priceField(), { target: { value: '999' } });

    getCommunityPrice.mockResolvedValue(price(500, minutesAgo(0), { latestOrigin: 'external' }));
    refreshRecipePrices.mockResolvedValue({ status: 'ok', refreshed: 1 });
    fireEvent.click(refreshButton());

    expect(await screen.findByRole('status')).toHaveTextContent('Prix actualisés.');
    await waitFor(() => expect(getCommunityPrice.mock.calls.length).toBeGreaterThan(1));
    expect(priceField()).toHaveValue('999');
  });

  it.each<[RecipeRefreshOutcome, string]>([
    [{ status: 'too-soon' }, 'Réessaie dans quelques secondes.'],
    [{ status: 'not-read' }, 'Les prix de ce serveur ne sont pas relus.'],
    [{ status: 'unavailable' }, 'Actualisation impossible pour le moment.'],
  ])('explains a refusal or a failure and keeps the prices shown: %o (US2)', async (outcome, message) => {
    await openRecherche();
    await waitFor(() => expect(priceField()).toHaveValue('120'));
    const reads = getCommunityPrice.mock.calls.length;
    refreshRecipePrices.mockResolvedValue(outcome);

    fireEvent.click(refreshButton());

    expect(await screen.findByRole('status')).toHaveTextContent(message);
    expect(priceField()).toHaveValue('120');
    expect(refreshButton()).toBeEnabled();
    // Nothing was read again: there is nothing new to show.
    expect(getCommunityPrice.mock.calls.length).toBe(reads);
  });

  it('drops the message when another item is shown (FR-006)', async () => {
    await openRecherche();
    refreshRecipePrices.mockResolvedValue({ status: 'ok', refreshed: 0 });
    fireEvent.click(refreshButton());
    expect(await screen.findByRole('status')).toHaveTextContent('Les prix sont déjà à jour.');

    fireEvent.click(screen.getByRole('button', { name: /Dague Boueuse/ }));

    await waitFor(() => expect(screen.queryByText('Les prix sont déjà à jour.')).not.toBeInTheDocument());
    expect(refreshButton()).toBeEnabled();
  });
});

describe('mention d’un prix Huzounet fragile sur une ligne de ressource (specs/047, US3)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('craftcheck-search-tour-seen', '1');
    globalThis.indexedDB = new IDBFactory();
    getCommunityPrice.mockReset();
    getLatestItemPrice.mockReset();
    getLatestItemPrice.mockResolvedValue({ status: 'not-found' });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('says « peu de relevés » for a provisional Huzounet price', async () => {
    getCommunityPrice.mockResolvedValue(price(120, minutesAgo(60), { latestOrigin: 'external', latestFragile: 'provisional' }));
    await openRecherche();
    expect(await screen.findByText(/· peu de relevés/)).toHaveClass('price-note');
  });

  it('says « relevé ancien » for an old Huzounet price', async () => {
    getCommunityPrice.mockResolvedValue(price(120, minutesAgo(60), { latestOrigin: 'external', latestFragile: 'stale' }));
    await openRecherche();
    expect(await screen.findByText(/· relevé ancien/)).toBeInTheDocument();
  });

  it('says nothing for a price shared by the group, nor for a sound Huzounet price', async () => {
    getCommunityPrice.mockResolvedValue(price(120, minutesAgo(60), { latestOrigin: 'manual' }));
    const first = await openRecherche();
    await waitFor(() => expect(priceField()).toHaveValue('120'));
    expect(document.querySelector('.price-note')).toBeNull();
    first.unmount();

    getCommunityPrice.mockResolvedValue(price(130, minutesAgo(30), { latestOrigin: 'external' }));
    await openRecherche('community', true);
    await waitFor(() => expect(priceField()).toHaveValue('130'));
    expect(document.querySelector('.price-note')).toBeNull();
  });

  it('says nothing while the player is typing another price', async () => {
    getCommunityPrice.mockResolvedValue(price(120, minutesAgo(60), { latestOrigin: 'external', latestFragile: 'provisional' }));
    await openRecherche();
    await screen.findByText(/· peu de relevés/);
    await waitFor(() => expect(priceField()).toHaveValue('120'));
    fireEvent.change(priceField(), { target: { value: '999' } });
    await waitFor(() => expect(document.querySelector('.price-note')).toBeNull());
  });

  it('keeps the mention with the price kept on the device, when the service cannot be reached (FR-009)', async () => {
    getCommunityPrice.mockResolvedValue(price(120, minutesAgo(60), { latestOrigin: 'external', latestFragile: 'provisional' }));
    const first = await openRecherche();
    await screen.findByText(/· peu de relevés/);
    first.unmount();

    getCommunityPrice.mockResolvedValue({ status: 'unavailable' });
    await openRecherche('community', true);
    await waitFor(() => expect(priceField()).toHaveValue('120'));
    expect(await screen.findByText(/· peu de relevés/)).toBeInTheDocument();
  });
});
