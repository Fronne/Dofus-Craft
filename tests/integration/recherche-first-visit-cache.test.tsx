import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
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

vi.mock('../../src/services/community-price-api', () => ({
  getCommunityPrice: vi.fn().mockResolvedValue({ status: 'not-found' }),
  getCommunityPrices: vi.fn().mockResolvedValue({ status: 'found', prices: [] }),
  submitCommunityPrice: vi.fn(),
}));

vi.mock('../../src/data/servers-repository', () => ({
  getServers: vi.fn().mockResolvedValue([
    { id: 'mikhal', name: 'Mikhal', type: 'mono' },
    { id: 'dakal', name: 'Dakal', type: 'mono' },
  ]),
}));

import App from '../../src/app/App';

const CATEGORIES = [{ id: 'cat-1', label: 'Épées', sortOrder: 1, kind: 'Equipment' as const, typeIds: [] }];
const ITEM = { id: 'item-1', name: 'Épée Boueuse', level: 1, kind: 'Equipment' as const, categoryId: 'cat-1' };
const SEARCH_PAGE_V1 = { total: 1, limit: 12, skip: 0, data: [ITEM] };
const DETAIL_V1 = {
  recipe: { id: 'recipe-1', itemId: 'item-1', ingredients: [{ resourceId: 'resource-1', quantity: 2 }] },
  resources: [{ id: 'resource-1', name: 'Bois' }],
  stats: [],
};

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe('premier accès sans cache local (specs/010-search-instant-cache, US3)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    // These scenarios are about Mode personnel, no longer the default for a new player.
    window.localStorage.setItem('craftcheck-price-mode-choice', 'personal');
    globalThis.indexedDB = new IDBFactory();
    getCategories.mockReset();
    searchItems.mockReset();
    getItemDetail.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('shows the existing loading state until the network resolves, then the results (FR-006, SC-004)', async () => {
    const categoriesCall = deferred<typeof CATEGORIES>();
    const searchCall = deferred<typeof SEARCH_PAGE_V1>();
    getCategories.mockReturnValue(categoriesCall.promise);
    searchItems.mockReturnValue(searchCall.promise);
    getItemDetail.mockReturnValue(new Promise(() => undefined));

    const { unmount } = render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));

    // Nothing cached anywhere: the skeleton is shown, matching today's behavior, until the network
    // resolves — this must still be true even with the new stale-while-revalidate machinery wired in.
    expect(document.querySelector('.skeleton-grid')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /Épée Boueuse/ })).not.toBeInTheDocument();

    categoriesCall.resolve(CATEGORIES);
    searchCall.resolve(SEARCH_PAGE_V1);

    await waitFor(() => expect(document.querySelector('.skeleton-grid')).toBeNull());
    expect(await screen.findByRole('button', { name: /Épée Boueuse/ })).toBeInTheDocument();

    unmount();
  });

  it('shows the loading state again for prices when switching to a server never used before, instead of leaking the previous server\'s prices', async () => {
    getCategories.mockResolvedValue(CATEGORIES);
    searchItems.mockResolvedValue(SEARCH_PAGE_V1);
    getItemDetail.mockResolvedValue(DETAIL_V1);
    await prices.save('mikhal', 'resource-1', 150);

    const { unmount } = render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
    await waitFor(() => expect(screen.getByPlaceholderText('Prix unitaire')).toHaveValue('150'));

    fireEvent.click(screen.getByRole('button', { name: /serveur actif/i }));
    fireEvent.click(screen.getByRole('option', { name: 'Dakal' }));

    // "dakal" has never had a price saved for resource-1 — the field must go back to empty, never
    // keep showing "150" (which belongs to "mikhal").
    await waitFor(() => expect(screen.getByPlaceholderText('Prix unitaire')).toHaveValue(''));

    unmount();
  });
});
