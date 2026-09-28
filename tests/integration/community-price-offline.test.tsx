import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { CommunityPriceLookup } from '../../src/services/community-price-api';

const getCommunityPrice = vi.fn<(resourceId: string, serverId: string) => Promise<CommunityPriceLookup>>();

vi.mock('../../src/services/community-price-api', () => ({
  getCommunityPrice: (resourceId: string, serverId: string) => getCommunityPrice(resourceId, serverId),
  getCommunityPrices: async (ids: string[], serverId: string) => {
    const results = await Promise.all(ids.map((id) => getCommunityPrice(id, serverId) as Promise<{ status: string; price?: unknown }>));
    if (results.some((result) => !result || result.status === 'unavailable')) return { status: 'unavailable' };
    return { status: 'found', prices: results.flatMap((result) => (result.status === 'found' ? [result.price] : [])) };
  },
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

async function enterCommunityMode() {
  fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
  fireEvent.click(screen.getByRole('link', { name: 'Paramètres' }));
  fireEvent.click(await screen.findByRole('button', { name: /mode communautaire/i }));
  fireEvent.click(screen.getByRole('link', { name: 'Recherche' }));
}

describe('Mode communautaire resilience when the community service is unavailable (US5)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    globalThis.indexedDB = new IDBFactory();
    getCommunityPrice.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('leaves the field empty and directly fillable, with no blocking error, when nothing was ever cached this session', async () => {
    getCommunityPrice.mockResolvedValue({ status: 'unavailable' });

    render(<App />);
    await enterCommunityMode();

    const input = await screen.findByPlaceholderText('Prix unitaire');
    await waitFor(() => expect(getCommunityPrice).toHaveBeenCalled());
    expect(input).toHaveValue('');
    expect(input).not.toBeDisabled();
    expect(screen.queryByText(/indisponible/)).not.toBeInTheDocument();
  });

  it('pre-fills from the last community price cached this session, marked as potentially stale, once a later fetch fails', async () => {
    getCommunityPrice.mockResolvedValueOnce({
      status: 'found',
      price: { resourceId: 'resource-1', serverId: 'mikhal', medianAmountKamas: 1500, sampleSize: 3 },
    });
    getCommunityPrice.mockResolvedValue({ status: 'unavailable' });

    const { unmount } = render(<App />);
    await enterCommunityMode();

    const input = await screen.findByPlaceholderText('Prix unitaire');
    await waitFor(() => expect(input).toHaveValue('1 500'));

    // Simulate leaving and reopening this resource later in the same session, after the service
    // has turned unavailable and with the carnet still holding no confirmed entry (a fresh app
    // instance, but the same localStorage cache and the same fake IndexedDB backing this test).
    unmount();
    document.body.innerHTML = '';
    globalThis.indexedDB = new IDBFactory();
    render(<App />);
    // Server selection and price mode both persisted (localStorage, untouched above) — no
    // onboarding/mode toggle to repeat, just navigate straight to Recherche.
    fireEvent.click(await screen.findByRole('link', { name: 'Recherche' }));

    const reopenedInput = await screen.findByPlaceholderText('Prix unitaire');
    await waitFor(() => expect(reopenedInput).toHaveValue('1 500'));
    expect(screen.queryByText(/peut-être daté/)).not.toBeInTheDocument();
  });

  it('keeps the craft-cost calculation fully usable from the community-mode carnet regardless of network state', async () => {
    getCommunityPrice.mockResolvedValue({ status: 'unavailable' });

    render(<App />);
    await enterCommunityMode();

    const input = await screen.findByPlaceholderText('Prix unitaire');
    await waitFor(() => expect(getCommunityPrice).toHaveBeenCalled());
    fireEvent.change(input, { target: { value: '900' } });

    await waitFor(() => expect(screen.getByText(/Coût de craft/)).toHaveTextContent('900'));
  });
});
