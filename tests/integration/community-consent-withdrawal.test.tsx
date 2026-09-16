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
import { addLocalContribution, listLocalContributions } from '../../src/persistence/community-contributions';

function goToSettings() {
  fireEvent.click(screen.getByRole('link', { name: 'Paramètres' }));
}

function goToSearch() {
  fireEvent.click(screen.getByRole('link', { name: 'Recherche' }));
}

describe('withdrawing community consent and past contributions (specs/004-community-price-sharing US4)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_input: string, init?: RequestInit) => {
      if (!init || init.method === undefined) return Promise.resolve(new Response('null', { status: 404 }));
      if (init.method === 'DELETE') return Promise.resolve(new Response(null, { status: 204 }));
      return Promise.resolve(new Response(JSON.stringify({ id: 'contribution-2' }), { status: 201 }));
    }));
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('blocks any further contribution once consent is retracted, even after a personal price is later edited', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
    goToSettings();
    fireEvent.click(await screen.findByRole('button', { name: /mode communautaire/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Partager mes prix' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Ne pas partager' }));

    goToSearch();
    fireEvent.change(await screen.findByPlaceholderText('Prix unitaire'), { target: { value: '1000' } });

    expect(screen.queryByRole('button', { name: 'Contribuer ce prix à la communauté' })).not.toBeInTheDocument();
    expect(screen.getByText(/Activez le partage communautaire/)).toBeInTheDocument();
  });

  it('withdraws already-sent contributions only after confirmation, and clears the local record', async () => {
    addLocalContribution({ id: 'contribution-1', resourceId: 'resource-1', serverId: 'mikhal' });

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
    goToSettings();
    fireEvent.click(await screen.findByRole('button', { name: /mode communautaire/i }));

    const withdrawButton = await screen.findByRole('button', { name: /Retirer mes 1 contribution déjà envoyée/ });

    // Canceling the confirmation must not call the withdrawal endpoint at all.
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(withdrawButton);
    await Promise.resolve();
    expect(listLocalContributions()).toHaveLength(1);

    confirmSpy.mockReturnValue(true);
    fireEvent.click(withdrawButton);

    await waitFor(() => expect(screen.queryByRole('button', { name: /Retirer mes/ })).not.toBeInTheDocument());
    expect(listLocalContributions()).toEqual([]);
  });
});
