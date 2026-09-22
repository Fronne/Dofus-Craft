import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { catalogueCache } from '../../src/persistence/indexeddb-catalogue-cache-store';
import { prices } from '../../src/persistence/indexeddb-resource-price-repository';

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
const SEARCH_KEY = 'search::::12';
const ITEM = { id: 'item-1', name: 'Épée Boueuse', level: 1, kind: 'Equipment' as const, categoryId: 'cat-1' };
const SEARCH_PAGE_V1 = { total: 1, limit: 12, skip: 0, data: [ITEM] };
const DETAIL_V1 = {
  recipe: { id: 'recipe-1', itemId: 'item-1', ingredients: [{ resourceId: 'resource-1', quantity: 2 }] },
  resources: [{ id: 'resource-1', name: 'Bois' }],
  stats: [],
};

async function selectServerAndGoToSearch() {
  fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
}

describe('résilience hors ligne sur la page Recherche (specs/010-search-instant-cache, US2)', () => {
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

  it('keeps showing the cached data and a discreet offline indicator when the network fails (FR-007/FR-008)', async () => {
    getCategories.mockRejectedValue(new Error('network down'));
    searchItems.mockRejectedValue(new Error('network down'));
    getItemDetail.mockRejectedValue(new Error('network down'));

    await catalogueCache.set('categories', CATEGORIES);
    await catalogueCache.set(SEARCH_KEY, SEARCH_PAGE_V1);
    await catalogueCache.set('detail:item-1', DETAIL_V1);
    await prices.save('mikhal', 'resource-1', 150);

    const { unmount } = render(<App />);
    await selectServerAndGoToSearch();

    // The cached data is still shown even though every network mock rejects.
    expect(await screen.findByRole('button', { name: /Épée Boueuse/ })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByPlaceholderText('Prix unitaire')).toHaveValue('150'));

    // No blocking error message anywhere on the page.
    expect(screen.queryByText(/Impossible de charger/)).not.toBeInTheDocument();

    // The discreet offline indicator eventually appears once the failed revalidation settles.
    await waitFor(() => expect(screen.getByText(/données hors ligne/i)).toBeInTheDocument());

    unmount();
  });

  it('shows the normal loading state (no offline indicator) on a first visit with nothing cached and a failing network', async () => {
    getCategories.mockRejectedValue(new Error('network down'));
    searchItems.mockRejectedValue(new Error('network down'));

    const { unmount } = render(<App />);
    await selectServerAndGoToSearch();

    // FR-006: with nothing cached, a failure surfaces as the existing inline error (the mock's
    // own Error#message, matching pre-existing behavior), not as the "données hors ligne"
    // indicator reserved for revalidation failures over already-cached data.
    await waitFor(() => expect(screen.getByText('network down')).toBeInTheDocument());
    expect(screen.queryByText(/données hors ligne/i)).not.toBeInTheDocument();

    unmount();
  });
});
