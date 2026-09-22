import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { catalogueCache } from '../../src/persistence/indexeddb-catalogue-cache-store';
import { prices } from '../../src/persistence/indexeddb-resource-price-repository';
import { communityModePrices } from '../../src/persistence/indexeddb-community-mode-price-repository';

const searchItems = vi.fn();
const getItemDetail = vi.fn();
const getCategories = vi.fn();

vi.mock('../../src/data/catalogue-repository', () => ({
  getCategories: (...args: unknown[]) => getCategories(...args),
  searchItems: (...args: unknown[]) => searchItems(...args),
  getItemDetail: (...args: unknown[]) => getItemDetail(...args),
  preloadCatalogueIndexes: vi.fn(),
  whenCatalogueReady: vi.fn().mockResolvedValue(undefined),
  getManifest: vi.fn().mockReturnValue({
    sourceName: 'test',
    sourceVersion: '1',
    catalogueVersion: '1',
    publishedAt: new Date().toISOString(),
  }),
}));

const getCommunityPrice = vi.fn();
vi.mock('../../src/services/community-price-api', () => ({
  getCommunityPrice: (...args: unknown[]) => getCommunityPrice(...args),
  submitCommunityPrice: vi.fn(),
}));

vi.mock('../../src/data/servers-repository', () => ({
  getServers: vi.fn().mockResolvedValue([{ id: 'mikhal', name: 'Mikhal', type: 'mono' }]),
}));

import App from '../../src/app/App';

const CATEGORIES = [{ id: 'cat-1', label: 'Épées', sortOrder: 1, kind: 'Equipment' as const, typeIds: [] }];
// Matches the debounced key format built in useCatalogue.ts: `search:${query}:${categoryId}:${levelFilter}:${resultLimit}`.
const SEARCH_KEY = 'search::::12';
const ITEM = { id: 'item-1', name: 'Épée Boueuse', level: 1, kind: 'Equipment' as const, categoryId: 'cat-1' };
const SEARCH_PAGE_V1 = { total: 1, limit: 12, skip: 0, data: [ITEM] };
const DETAIL_V1 = {
  recipe: { id: 'recipe-1', itemId: 'item-1', ingredients: [{ resourceId: 'resource-1', quantity: 2 }] },
  resources: [{ id: 'resource-1', name: 'Bois' }],
  stats: [],
};

// Lets a mock stay pending through the "instant display" assertions below (so anything visible at
// that point can only have come from the local cache), independently of when it's eventually
// resolved.
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function selectServerAndGoToSearch() {
  fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
}

describe('affichage instantané du cache local sur la page Recherche (specs/010-search-instant-cache, US1)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    globalThis.indexedDB = new IDBFactory();
    getCategories.mockReset();
    searchItems.mockReset();
    getItemDetail.mockReset();
    getCommunityPrice.mockReset();
    getCommunityPrice.mockResolvedValue({ status: 'not-found' });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('shows the cached item list, recipe and personal price immediately, without waiting for the network (FR-001, SC-001)', async () => {
    // Pending through the assertions below — anything visible at that point can only come from
    // the cache — then resolved with matching data at the end so nothing is left dangling.
    const categoriesCall = deferred<typeof CATEGORIES>();
    const searchCall = deferred<typeof SEARCH_PAGE_V1>();
    const detailCall = deferred<typeof DETAIL_V1>();
    getCategories.mockReturnValue(categoriesCall.promise);
    searchItems.mockReturnValue(searchCall.promise);
    getItemDetail.mockReturnValue(detailCall.promise);

    await catalogueCache.set('categories', CATEGORIES);
    await catalogueCache.set(SEARCH_KEY, SEARCH_PAGE_V1);
    await catalogueCache.set('detail:item-1', DETAIL_V1);
    await prices.save('mikhal', 'resource-1', 150);

    const { unmount } = render(<App />);
    await selectServerAndGoToSearch();

    expect(await screen.findByRole('button', { name: /Épée Boueuse/ })).toBeInTheDocument();
    expect(screen.queryByText('Chargement des détails…')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByPlaceholderText('Prix unitaire')).toHaveValue('150'));

    // Explicitly unmounted (unlike the older `tests/integration/community-*.test.tsx` files, which
    // rely on `document.body.innerHTML = ''` plus a fresh `globalThis.indexedDB` instead) so this
    // test's effects — including the deliberately still-pending mocks above — are fully torn down
    // rather than left suspended into the next test.
    unmount();
    categoriesCall.resolve(CATEGORIES);
    searchCall.resolve(SEARCH_PAGE_V1);
    detailCall.resolve(DETAIL_V1);
  });

  it('shows the cached community-mode carnet price immediately, without waiting for the network (US1, scenario 3)', async () => {
    getCategories.mockResolvedValue(CATEGORIES);
    searchItems.mockResolvedValue(SEARCH_PAGE_V1);
    getItemDetail.mockResolvedValue(DETAIL_V1);
    const communityPriceCall = deferred<{ status: 'not-found' }>();
    getCommunityPrice.mockReturnValue(communityPriceCall.promise);

    await communityModePrices.save('mikhal', 'resource-1', 250);

    const { unmount } = render(<App />);
    await selectServerAndGoToSearch();
    // Let RecherchePage's own "auto-select the first result" effect settle before navigating away
    // — otherwise its URL update (`replace: true`) can race the Paramètres navigation and win,
    // undoing it.
    await screen.findByRole('button', { name: /Épée Boueuse/ });
    fireEvent.click(await screen.findByRole('link', { name: 'Paramètres' }));
    fireEvent.click(await screen.findByRole('button', { name: /mode communautaire/i }));
    fireEvent.click(await screen.findByRole('link', { name: 'Recherche' }));

    await waitFor(() => expect(screen.getByPlaceholderText('Prix unitaire')).toHaveValue('250'));

    unmount();
    communityPriceCall.resolve({ status: 'not-found' });
  });

  it('updates the display once the network responds with different data, without resetting the search or the selected item (FR-004/FR-005)', async () => {
    let resolveSearch!: (value: typeof SEARCH_PAGE_V1) => void;
    let resolveDetail!: (value: typeof DETAIL_V1) => void;
    getCategories.mockResolvedValue(CATEGORIES);
    searchItems.mockReturnValue(new Promise((resolve) => { resolveSearch = resolve; }));
    getItemDetail.mockReturnValue(new Promise((resolve) => { resolveDetail = resolve; }));

    await catalogueCache.set('categories', CATEGORIES);
    await catalogueCache.set(SEARCH_KEY, SEARCH_PAGE_V1);
    await catalogueCache.set('detail:item-1', DETAIL_V1);
    await prices.save('mikhal', 'resource-1', 150);

    const { unmount } = render(<App />);
    await selectServerAndGoToSearch();

    expect(await screen.findByRole('button', { name: /Épée Boueuse/ })).toBeInTheDocument();
    const searchInput = screen.getByPlaceholderText(/rechercher/i);
    expect(searchInput).toHaveValue('');

    const updatedItem = { ...ITEM, name: 'Épée Boueuse+' };
    resolveSearch({ total: 1, limit: 12, skip: 0, data: [updatedItem] });
    resolveDetail(DETAIL_V1);

    await waitFor(() => expect(screen.getByRole('button', { name: /Épée Boueuse\+/ })).toBeInTheDocument());
    // The search query stayed untouched by this background revalidation.
    expect(searchInput).toHaveValue('');
    unmount();
  });

  it('shows a discreet "Mise à jour…" indicator while revalidating, then nothing once it settles (US4)', async () => {
    let resolveSearch!: (value: typeof SEARCH_PAGE_V1) => void;
    getCategories.mockResolvedValue(CATEGORIES);
    searchItems.mockReturnValue(new Promise((resolve) => { resolveSearch = resolve; }));
    getItemDetail.mockResolvedValue(DETAIL_V1);

    await catalogueCache.set('categories', CATEGORIES);
    await catalogueCache.set(SEARCH_KEY, SEARCH_PAGE_V1);
    await catalogueCache.set('detail:item-1', DETAIL_V1);
    await prices.save('mikhal', 'resource-1', 150);

    const { unmount } = render(<App />);
    await selectServerAndGoToSearch();

    expect(await screen.findByRole('button', { name: /Épée Boueuse/ })).toBeInTheDocument();
    expect(screen.getByText('Mise à jour…')).toBeInTheDocument();

    resolveSearch(SEARCH_PAGE_V1);

    await waitFor(() => expect(screen.queryByText('Mise à jour…')).not.toBeInTheDocument());
    // Once settled and online, the indicator disappears entirely rather than leaving a lone
    // marker on screen — see SyncStatusIndicator.tsx for why the FR-013 affordance was dropped.
    expect(document.querySelector('.sync-status')).not.toBeInTheDocument();

    unmount();
  });
});
