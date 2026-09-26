import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prices } from '../../src/persistence/indexeddb-resource-price-repository';
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
  getServers: vi.fn().mockResolvedValue([
    { id: 'mikhal', name: 'Mikhal', type: 'mono' },
    { id: 'dakal', name: 'Dakal', type: 'mono' },
  ]),
}));

import App from '../../src/app/App';

describe('switching price mode never alters personal prices', () => {
  beforeEach(() => {
    window.localStorage.clear();
    // These scenarios are about Mode personnel, no longer the default for a new player.
    window.localStorage.setItem('craftcheck-price-mode-choice', 'personal');
    getCommunityPrice.mockResolvedValue({ status: 'not-found' });
  });
  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  // specs/004-community-price-sharing (révision) FR-005: Mode communautaire reads/writes a
  // physically separate carnet, so it no longer shows the Mode personnel price at all — this test
  // now checks the guarantee that still matters: the Mode personnel carnet itself is never
  // altered by visiting Mode communautaire, however many times the player round-trips.
  it('keeps the personal resource price identical across repeated mode round trips', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));

    const priceInput = await screen.findByPlaceholderText('Prix unitaire');
    fireEvent.change(priceInput, { target: { value: '1000' } });
    // Persistence only happens once the field is blurred, same convention as
    // comparison-screen.test.tsx.
    fireEvent.blur(priceInput);

    await waitFor(async () => {
      expect(await prices.get('mikhal', 'resource-1')).toMatchObject({ unitPriceKamas: 1000 });
    });

    // Round-trip through the Paramètres page (where the mode selector now lives) and back to
    // Recherche, which fully unmounts/remounts the price input: this exercises real persistence,
    // not just in-memory React state.
    for (let i = 0; i < 3; i += 1) {
      fireEvent.click(screen.getByRole('link', { name: 'Paramètres' }));
      fireEvent.click(await screen.findByRole('button', { name: /mode communautaire/i }));

      fireEvent.click(screen.getByRole('link', { name: 'Recherche' }));
      await waitFor(() => expect(screen.getByPlaceholderText('Prix unitaire')).toHaveValue(''));

      fireEvent.click(screen.getByRole('link', { name: 'Paramètres' }));
      fireEvent.click(await screen.findByRole('button', { name: /mode personnel/i }));

      fireEvent.click(screen.getByRole('link', { name: 'Recherche' }));
      await waitFor(() => expect(screen.getByPlaceholderText('Prix unitaire')).toHaveValue('1 000'));
    }

    const stored = await prices.get('mikhal', 'resource-1');
    expect(stored?.unitPriceKamas).toBe(1000);
  });
});
