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
  ]),
}));

import App from '../../src/app/App';

function goToSettings() {
  fireEvent.click(screen.getByRole('link', { name: 'Paramètres' }));
}

function goToSearch() {
  fireEvent.click(screen.getByRole('link', { name: 'Recherche' }));
}

describe('community price consent gate (specs/004-community-price-sharing US2)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('never sends a community request while consent is off, and sends only resourceId/serverId/amountKamas once consent is given', async () => {
    const fetchMock = vi.fn().mockImplementation((_input: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return Promise.resolve(new Response(JSON.stringify({ id: 'contribution-1' }), { status: 201 }));
      }
      return Promise.resolve(new Response('null', { status: 404 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
    goToSettings();
    fireEvent.click(await screen.findByRole('button', { name: /mode communautaire/i }));

    goToSearch();
    fireEvent.change(await screen.findByPlaceholderText('Prix unitaire'), { target: { value: '1000' } });

    // Reading the community price is allowed even without consent (US1); only *contributing* is gated.
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls.every(([, init]) => (init as RequestInit | undefined)?.method !== 'POST')).toBe(true);
    expect(screen.getByText(/Activez le partage communautaire/)).toBeInTheDocument();

    fetchMock.mockClear();
    goToSettings();
    fireEvent.click(await screen.findByRole('button', { name: 'Partager mes prix' }));
    expect(await screen.findByText(/Partage actif/)).toBeInTheDocument();

    goToSearch();
    await waitFor(() => expect(screen.getByPlaceholderText('Prix unitaire')).toHaveValue('1 000'));
    const contributeButton = await screen.findByRole('button', { name: 'Contribuer ce prix à la communauté' });
    await waitFor(() => expect(contributeButton).toBeEnabled());
    fireEvent.click(contributeButton);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: 'POST' }),
    ));
    const call = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'POST');
    const body = JSON.parse((call![1] as RequestInit).body as string);
    expect(body).toEqual({ resourceId: 'resource-1', serverId: 'mikhal', amountKamas: 1000 });
  });

  it('never allows a contribution once the player switches back to personal mode, even though consent stays given (FR-014)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('null', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
    goToSettings();
    fireEvent.click(await screen.findByRole('button', { name: /mode communautaire/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Partager mes prix' }));

    fireEvent.click(await screen.findByRole('button', { name: /^Mode personnel/i }));
    goToSearch();
    fireEvent.change(await screen.findByPlaceholderText('Prix unitaire'), { target: { value: '1000' } });

    expect(screen.queryByRole('button', { name: 'Contribuer ce prix à la communauté' })).not.toBeInTheDocument();
  });
});
