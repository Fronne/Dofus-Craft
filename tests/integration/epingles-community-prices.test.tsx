import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { formatKamas } from '../../src/domain/kamas';
import type { CommunityPriceLookup } from '../../src/services/community-price-api';

const normalizeSpaces = (value: string) => value.replace(/ /g, ' ');

const getCommunityPrice = vi.fn<(resourceId: string, serverId: string) => Promise<CommunityPriceLookup>>();

vi.mock('../../src/services/community-price-api', () => ({
  getCommunityPrice: (resourceId: string, serverId: string) => getCommunityPrice(resourceId, serverId),
  submitCommunityPrice: vi.fn().mockResolvedValue(undefined),
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

    await waitFor(() => expect(screen.getByRole('button', { name: 'Épingler' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Épingler' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Désépingler' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('link', { name: /Épinglés/ }));
    const card = (await screen.findByText('Épée Boueuse')).closest('.pinned-card') as HTMLElement;
    await waitFor(() => expect(within(card).getByText(/Craft :/)).toHaveTextContent('Craft : Non renseigné'));

    // Someone else prices the resource afterwards; the player comes back to Épinglés directly.
    getCommunityPrice.mockResolvedValue({
      status: 'found',
      price: { resourceId: 'resource-1', serverId: 'mikhal', medianAmountKamas: 5000, sampleSize: 3 },
    });
    fireEvent.click(screen.getByRole('link', { name: 'Paramètres' }));
    fireEvent.click(screen.getByRole('link', { name: /Épinglés/ }));

    const updatedCard = (await screen.findByText('Épée Boueuse')).closest('.pinned-card') as HTMLElement;
    await waitFor(() =>
      expect(within(updatedCard).getByText(/Craft :/)).toHaveTextContent(normalizeSpaces(`Craft : ${formatKamas(10000)}`)),
    );
  });
});
