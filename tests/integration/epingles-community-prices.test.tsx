import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { formatKamas } from '../../src/domain/kamas';
import type { CommunityPriceLookup } from '../../src/services/community-price-api';

const normalizeSpaces = (value: string) => value.replace(/\u202f/g, ' ');

const getCommunityPrice = vi.fn<(resourceId: string, serverId: string) => Promise<CommunityPriceLookup>>();

vi.mock('../../src/services/community-price-api', () => ({
  getCommunityPrice: (resourceId: string, serverId: string) => getCommunityPrice(resourceId, serverId),
  getCommunityPrices: async (ids: string[], serverId: string) => {
    const results = await Promise.all(ids.map((id) => getCommunityPrice(id, serverId) as Promise<{ status: string; price?: unknown }>));
    if (results.some((result) => !result || result.status === 'unavailable')) return { status: 'unavailable' };
    return { status: 'found', prices: results.flatMap((result) => (result.status === 'found' ? [result.price] : [])) };
  },
  submitCommunityPrice: vi.fn().mockResolvedValue(undefined),
  // specs/016: no shared HDV price in these scenarios.
  getLatestItemPrice: vi.fn().mockResolvedValue({ status: 'not-found' }),
}));

vi.mock('../../src/data/catalogue-repository', () => ({
  getCategories: vi.fn().mockResolvedValue([
    { id: 'cat-1', label: 'Épées', sortOrder: 1, kind: 'Equipment', typeIds: [] },
  ]),
  searchItems: vi.fn().mockResolvedValue({
    data: [{ id: 'item-1', name: 'Épée Boueuse', level: 1, kind: 'Equipment', categoryId: 'cat-1' }],
    total: 1,
  }),
  getItemDetail: vi.fn().mockResolvedValue({
    recipe: { id: 'recipe-1', itemId: 'item-1', ingredients: [{ resourceId: 'resource-1', quantity: 2 }] },
    resources: [{ id: 'resource-1', name: 'Bois' }],
    stats: [],
  }),
  preloadCatalogueIndexes: vi.fn(),
  whenCatalogueReady: vi.fn().mockResolvedValue(undefined),
  getManifest: vi.fn().mockReturnValue({
    sourceName: 'test',
    sourceVersion: '1',
    catalogueVersion: '1',
    publishedAt: new Date().toISOString(),
  }),
}));

vi.mock('../../src/data/servers-repository', () => ({
  getServers: vi.fn().mockResolvedValue([{ id: 'mikhal', name: 'Mikhal', type: 'mono' }]),
}));

import App from '../../src/app/App';
import { communityModePrices } from '../../src/persistence/indexeddb-community-mode-price-repository';

describe('pinned items page in Mode communautaire', () => {
  beforeEach(() => {
    window.localStorage.clear();
    globalThis.indexedDB = new IDBFactory();
    getCommunityPrice.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('uses the community median for a resource priced after the item was pinned, without reopening its detail', async () => {
    getCommunityPrice.mockResolvedValue({ status: 'not-found' });

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
    fireEvent.click(screen.getByRole('link', { name: 'Paramètres' }));
    fireEvent.click(await screen.findByRole('button', { name: /mode communautaire/i }));
    fireEvent.click(screen.getByRole('link', { name: 'Recherche' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Suivre' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Suivre' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Ne plus suivre' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('link', { name: /Suivis/ }));
    const card = (await screen.findByText('Épée Boueuse')).closest('.pinned-card') as HTMLElement;
    await waitFor(() => expect(within(card).getByText(/Craft :/)).toHaveTextContent('Craft : Non renseigné'));

    // Someone else prices the resource afterwards; the player comes back to Épinglés directly.
    getCommunityPrice.mockResolvedValue({
      status: 'found',
      price: { resourceId: 'resource-1', serverId: 'mikhal', medianAmountKamas: 5000, sampleSize: 3, latestAmountKamas: 5000, latestContributionAt: '2026-09-01T12:00:00.000Z' },
    });
    fireEvent.click(screen.getByRole('link', { name: 'Paramètres' }));
    fireEvent.click(screen.getByRole('link', { name: /Suivis/ }));

    const updatedCard = (await screen.findByText('Épée Boueuse')).closest('.pinned-card') as HTMLElement;
    await waitFor(() =>
      expect(within(updatedCard).getByText(/Craft :/)).toHaveTextContent(normalizeSpaces(`Craft : ${formatKamas(10000)}`)),
    );
  });
  // specs/024-latest-community-price (FR-004, FR-007): an older kept price is replaced by the latest
  // shared one on the Suivis page too.
  it('replaces an older kept price by the latest shared one (specs/024)', async () => {
    await communityModePrices.save('mikhal', 'resource-1', 1000, '2026-09-01T12:00:00.000Z');
    getCommunityPrice.mockResolvedValue({ status: 'not-found' });

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
    fireEvent.click(screen.getByRole('link', { name: 'Paramètres' }));
    fireEvent.click(await screen.findByRole('button', { name: /mode communautaire/i }));
    fireEvent.click(screen.getByRole('link', { name: 'Recherche' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Suivre' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Ne plus suivre' })).toBeInTheDocument());

    getCommunityPrice.mockResolvedValue({
      status: 'found',
      price: { resourceId: 'resource-1', serverId: 'mikhal', medianAmountKamas: 1000, sampleSize: 3, latestAmountKamas: 3000, latestContributionAt: '2026-09-27T12:00:00.000Z' },
    });
    fireEvent.click(screen.getByRole('link', { name: /Suivis/ }));

    const card = (await screen.findByText('Épée Boueuse')).closest('.pinned-card') as HTMLElement;
    await waitFor(() =>
      expect(within(card).getByText(/Craft :/)).toHaveTextContent(normalizeSpaces(`Craft : ${formatKamas(6000)}`)),
    );
  });
});
