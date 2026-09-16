import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('personal price always wins over the community price (specs/004-community-price-sharing US3)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(
      { resourceId: 'resource-1', serverId: 'mikhal', medianAmountKamas: 5000, sampleSize: 3 },
    ), { status: 200 })));
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('uses only the personal price for the craft-cost calculation, keeping the community price shown separately', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
    fireEvent.click(screen.getByRole('link', { name: 'Paramètres' }));
    fireEvent.click(await screen.findByRole('button', { name: /mode communautaire/i }));
    fireEvent.click(screen.getByRole('link', { name: 'Recherche' }));

    fireEvent.change(await screen.findByPlaceholderText('Prix unitaire'), { target: { value: '1000' } });

    // Community median (5 000) is visible...
    expect(await screen.findByText(/5 000/)).toBeInTheDocument();
    // ...but the craft cost uses only the personal price (1 000 × 1), never the community value.
    await waitFor(() => expect(screen.getByText(/Coût de craft/)).toHaveTextContent('1 000'));
    expect(screen.getByText(/Coût de craft/)).not.toHaveTextContent('5 000');
  });
});
