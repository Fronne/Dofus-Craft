import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { CommunityPriceLookup } from '../../src/services/community-price-api';

const getCommunityPrice = vi.fn<(resourceId: string, serverId: string) => Promise<CommunityPriceLookup>>();

vi.mock('../../src/services/community-price-api', () => ({
  getCommunityPrice: (resourceId: string, serverId: string) => getCommunityPrice(resourceId, serverId),
  submitCommunityPrice: vi.fn(),
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
    recipe: { id: 'recipe-1', itemId: 'item-1', ingredients: [{ resourceId: 'resource-1', quantity: 1 }] },
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

function goToSettings() {
  fireEvent.click(screen.getByRole('link', { name: 'Paramètres' }));
}

function goToSearch() {
  fireEvent.click(screen.getByRole('link', { name: 'Recherche' }));
}

// Mode communautaire temporairement désactivé (src/domain/price-modes.ts, COMMUNITY_MODE_ENABLED)
// — ce mode n'est plus atteignable depuis l'interface pour l'instant ; à réactiver avec le mode.
describe.skip('the two price carnets are strictly independent (specs/004-community-price-sharing US2)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    globalThis.indexedDB = new IDBFactory();
    getCommunityPrice.mockReset();
    getCommunityPrice.mockResolvedValue({ status: 'not-found' });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('never shows or uses the Mode personnel price after switching to Mode communautaire', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));

    fireEvent.change(await screen.findByPlaceholderText('Prix unitaire'), { target: { value: '1000' } });
    await waitFor(() => expect(screen.getByText(/Coût de craft/)).toHaveTextContent('1 000'));

    goToSettings();
    fireEvent.click(await screen.findByRole('button', { name: /mode communautaire/i }));
    goToSearch();

    const communityInput = await screen.findByPlaceholderText('Prix unitaire');
    await waitFor(() => expect(getCommunityPrice).toHaveBeenCalled());
    expect(communityInput).toHaveValue('');
    expect(screen.queryByText(/Coût de craft/)).not.toHaveTextContent('1 000');
  });

  it('never shows or uses a Mode communautaire price after switching back to Mode personnel, and never alters the original personal price', async () => {
    getCommunityPrice.mockResolvedValue({
      status: 'found',
      price: { resourceId: 'resource-1', serverId: 'mikhal', medianAmountKamas: 5000, sampleSize: 2 },
    });

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));

    fireEvent.change(await screen.findByPlaceholderText('Prix unitaire'), { target: { value: '1000' } });
    await waitFor(() => expect(screen.getByText(/Coût de craft/)).toHaveTextContent('1 000'));

    goToSettings();
    fireEvent.click(await screen.findByRole('button', { name: /mode communautaire/i }));
    goToSearch();

    const communityInput = await screen.findByPlaceholderText('Prix unitaire');
    await waitFor(() => expect(communityInput).toHaveValue('5 000'));
    fireEvent.change(communityInput, { target: { value: '9000' } });
    await waitFor(() => expect(screen.getByText(/Coût de craft/)).toHaveTextContent('9 000'));

    goToSettings();
    fireEvent.click(await screen.findByRole('button', { name: /mode personnel/i }));
    goToSearch();

    const personalInput = await screen.findByPlaceholderText('Prix unitaire');
    await waitFor(() => expect(personalInput).toHaveValue('1 000'));
    expect(screen.getByText(/Coût de craft/)).toHaveTextContent('1 000');
  });
});
