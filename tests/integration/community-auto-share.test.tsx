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

async function enterCommunityMode() {
  fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
  goToSettings();
  fireEvent.click(await screen.findByRole('button', { name: /mode communautaire/i }));
  goToSearch();
}

function isPost(init?: RequestInit) {
  return init?.method === 'POST';
}

// specs/004-community-price-sharing (révision 4): replaces community-consent.test.tsx (révision
// 2's "editing never transmits anything by itself" guarantee is now false) and
// community-bulk-share.test.tsx (the bulk-share button it tested is removed). Sharing is no longer
// a separate action at all — it is the direct, automatic consequence of confirming an edit (blur
// after a real change) on a resource's price field in Mode communautaire (FR-017/FR-020).
// Mode communautaire temporairement désactivé (src/domain/price-modes.ts, COMMUNITY_MODE_ENABLED)
// — ce mode n'est plus atteignable depuis l'interface pour l'instant ; à réactiver avec le mode.
describe.skip('auto-sharing a resource price on commit (specs/004-community-price-sharing US1/US3)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('never sends a POST while a price is only read or being typed, before any blur', async () => {
    const fetchMock = vi.fn().mockImplementation((_input: string, init?: RequestInit) => {
      if (isPost(init)) return Promise.resolve(new Response(JSON.stringify({ id: 'contribution-1' }), { status: 201 }));
      return Promise.resolve(new Response('null', { status: 404 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    await enterCommunityMode();

    fireEvent.change(await screen.findByPlaceholderText('Prix unitaire'), { target: { value: '1000' } });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls.every(([, init]) => !isPost(init as RequestInit | undefined))).toBe(true);
  });

  it('sends exactly one POST with only resourceId/serverId/amountKamas once the field is confirmed (blur after a real change), then refreshes via GET (FR-017/FR-018/FR-019)', async () => {
    const postBodies: unknown[] = [];
    let median = { medianAmountKamas: 1200, sampleSize: 2 };
    const fetchMock = vi.fn().mockImplementation((_input: string, init?: RequestInit) => {
      if (isPost(init)) {
        postBodies.push(JSON.parse(init!.body as string));
        median = { medianAmountKamas: 1200, sampleSize: 3 };
        return Promise.resolve(new Response(JSON.stringify({ id: 'contribution-1' }), { status: 201 }));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ resourceId: 'resource-1', serverId: 'mikhal', ...median }), { status: 200 }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    await enterCommunityMode();

    const input = await screen.findByPlaceholderText('Prix unitaire');
    await waitFor(() => expect(input).toHaveValue('1 200'));

    fireEvent.click(screen.getByRole('button', { name: 'Modifier ce prix' }));
    fireEvent.change(input, { target: { value: '1000' } });
    fireEvent.blur(input);

    await waitFor(() => expect(postBodies).toHaveLength(1));
    expect(Object.keys(postBodies[0] as object).sort()).toEqual(['amountKamas', 'resourceId', 'serverId']);
    await waitFor(() => expect(screen.getByText(/3 contributions/)).toBeInTheDocument());
  });

  it('sends no POST when a field is unlocked and blurred again without any change (FR-020)', async () => {
    const fetchMock = vi.fn().mockImplementation((_input: string, init?: RequestInit) => {
      if (isPost(init)) return Promise.resolve(new Response(JSON.stringify({ id: 'contribution-1' }), { status: 201 }));
      return Promise.resolve(
        new Response(JSON.stringify({ resourceId: 'resource-1', serverId: 'mikhal', medianAmountKamas: 1200, sampleSize: 2 }), { status: 200 }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    await enterCommunityMode();

    const input = await screen.findByPlaceholderText('Prix unitaire');
    await waitFor(() => expect(input).toHaveValue('1 200'));

    fireEvent.click(screen.getByRole('button', { name: 'Modifier ce prix' }));
    fireEvent.blur(input);

    expect(fetchMock.mock.calls.every(([, init]) => !isPost(init as RequestInit | undefined))).toBe(true);
  });

  it('keeps the typed value visible and does not interrupt the page when the POST fails (FR-020)', async () => {
    const fetchMock = vi.fn().mockImplementation((_input: string, init?: RequestInit) => {
      if (isPost(init)) return Promise.resolve(new Response('error', { status: 500 }));
      return Promise.resolve(
        new Response(JSON.stringify({ resourceId: 'resource-1', serverId: 'mikhal', medianAmountKamas: 1200, sampleSize: 2 }), { status: 200 }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    await enterCommunityMode();

    const input = await screen.findByPlaceholderText('Prix unitaire');
    await waitFor(() => expect(input).toHaveValue('1 200'));

    fireEvent.click(screen.getByRole('button', { name: 'Modifier ce prix' }));
    fireEvent.change(input, { target: { value: '1000' } });
    fireEvent.blur(input);

    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => isPost(init as RequestInit | undefined))).toBe(true));
    expect(screen.getByPlaceholderText('Prix unitaire')).toHaveValue('1 000');
  });

  it('never shows any manual or bulk sharing action in Paramètres', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('null', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
    goToSettings();
    fireEvent.click(await screen.findByRole('button', { name: /mode communautaire/i }));

    expect(screen.queryByText('Partage communautaire')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Partager tous mes prix/ })).not.toBeInTheDocument();
  });
});
