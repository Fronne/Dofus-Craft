import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

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

// Distinguishes a POST /community-price from AppShell's own fire-and-forget POST /visit
// (specs/006-anonymous-visit-count, sent unconditionally on every mount) — both are plain POSTs on
// the same mocked fetch, so checking the method alone would misidentify a visit ping as a price
// contribution.
function isPost(url: string, init?: RequestInit) {
  return init?.method === 'POST' && url.includes('/community-price');
}

// specs/004-community-price-sharing (révision 4): replaces community-consent.test.tsx (révision
// 2's "editing never transmits anything by itself" guarantee is now false) and
// community-bulk-share.test.tsx (the bulk-share button it tested is removed). Sharing is no longer
// a separate action at all — it is the direct, automatic consequence of confirming an edit (blur
// after a real change) on a resource's price field in Mode communautaire (FR-017/FR-020).
describe('auto-sharing a resource price on commit (specs/004-community-price-sharing US1/US3)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    // specs/010-search-instant-cache: the community-mode carnet now correctly wins over a fresh
    // prefill once it holds an entry (FR-006 of specs/004) — each `it()` below must start from an
    // empty carnet for resource-1/mikhal rather than inheriting a previous test's committed price,
    // matching the reset already done in community-price-offline.test.tsx / community-price-prefill.test.tsx.
    globalThis.indexedDB = new IDBFactory();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
  });

  it('never sends a POST while a price is only read or being typed, before any blur', async () => {
    const fetchMock = vi.fn().mockImplementation((input: string, init?: RequestInit) => {
      if (isPost(input, init)) return Promise.resolve(new Response(JSON.stringify({ id: 'contribution-1' }), { status: 201 }));
      return Promise.resolve(new Response('null', { status: 404 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    await enterCommunityMode();

    fireEvent.change(await screen.findByPlaceholderText('Prix unitaire'), { target: { value: '1000' } });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls.every(([url, init]) => !isPost(url as string, init as RequestInit | undefined))).toBe(true);
  });

  it('sends exactly one POST with only resourceId/serverId/amountKamas once the field is confirmed (blur after a real change), then refreshes via GET (FR-017/FR-018/FR-019)', async () => {
    const postBodies: unknown[] = [];
    let median = { medianAmountKamas: 1200, sampleSize: 2 };
    const fetchMock = vi.fn().mockImplementation((input: string, init?: RequestInit) => {
      if (isPost(input, init)) {
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
    expect(Object.keys(postBodies[0] as object).sort()).toEqual(['amountKamas', 'deviceId', 'resourceId', 'serverId']);
    await waitFor(() => expect(screen.getByText(/3 contributions/)).toBeInTheDocument());
    // specs/004 FR-018 (amendée révision 6): the field keeps the player's own entered value (1000),
    // not the mock's recalculated median (1200).
    expect(input).toHaveValue('1 000');
  });

  it('sends no POST when a field is unlocked and blurred again without any change (FR-020)', async () => {
    const fetchMock = vi.fn().mockImplementation((input: string, init?: RequestInit) => {
      if (isPost(input, init)) return Promise.resolve(new Response(JSON.stringify({ id: 'contribution-1' }), { status: 201 }));
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

    expect(fetchMock.mock.calls.every(([url, init]) => !isPost(url as string, init as RequestInit | undefined))).toBe(true);
  });

  it('keeps the typed value visible and does not interrupt the page when the POST fails (FR-020)', async () => {
    const fetchMock = vi.fn().mockImplementation((input: string, init?: RequestInit) => {
      if (isPost(input, init)) return Promise.resolve(new Response('error', { status: 500 }));
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

    await waitFor(() => expect(fetchMock.mock.calls.some(([url, init]) => isPost(url as string, init as RequestInit | undefined))).toBe(true));
    expect(screen.getByPlaceholderText('Prix unitaire')).toHaveValue('1 000');
  });

  // specs/007-outlier-confirmation US1: a commit whose entered value deviates from the already-known
  // community median by more than 25% is gated behind a blocking confirmation before any POST is
  // sent.
  it('shows a confirmation and sends no POST before it is answered, when the entered value deviates more than 25% from the known median (FR-003/FR-004/FR-005)', async () => {
    const fetchMock = vi.fn().mockImplementation((input: string, init?: RequestInit) => {
      if (isPost(input, init)) return Promise.resolve(new Response(JSON.stringify({ id: 'contribution-1' }), { status: 201 }));
      return Promise.resolve(
        new Response(JSON.stringify({ resourceId: 'resource-1', serverId: 'mikhal', medianAmountKamas: 1000, sampleSize: 2 }), { status: 200 }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    await enterCommunityMode();

    const input = await screen.findByPlaceholderText('Prix unitaire');
    await waitFor(() => expect(input).toHaveValue('1 000'));

    fireEvent.click(screen.getByRole('button', { name: 'Modifier ce prix' }));
    fireEvent.change(input, { target: { value: '1300' } });
    fireEvent.blur(input);

    await screen.findByText(/Prix habituel/);
    expect(fetchMock.mock.calls.every(([url, init]) => !isPost(url as string, init as RequestInit | undefined))).toBe(true);
  });

  it('sends the value and refreshes the median once the confirmation is accepted', async () => {
    const postBodies: unknown[] = [];
    let median = { medianAmountKamas: 1000, sampleSize: 2 };
    const fetchMock = vi.fn().mockImplementation((input: string, init?: RequestInit) => {
      if (isPost(input, init)) {
        postBodies.push(JSON.parse(init!.body as string));
        median = { medianAmountKamas: 1000, sampleSize: 3 };
        return Promise.resolve(new Response(JSON.stringify({ id: 'contribution-1' }), { status: 201 }));
      }
      return Promise.resolve(new Response(JSON.stringify({ resourceId: 'resource-1', serverId: 'mikhal', ...median }), { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    await enterCommunityMode();

    const input = await screen.findByPlaceholderText('Prix unitaire');
    await waitFor(() => expect(input).toHaveValue('1 000'));

    fireEvent.click(screen.getByRole('button', { name: 'Modifier ce prix' }));
    fireEvent.change(input, { target: { value: '1300' } });
    fireEvent.blur(input);

    fireEvent.click(await screen.findByRole('button', { name: 'Enregistrer quand même' }));

    await waitFor(() => expect(postBodies).toHaveLength(1));
    expect(postBodies[0]).toMatchObject({ amountKamas: 1300 });
    await waitFor(() => expect(screen.getByText(/3 contributions/)).toBeInTheDocument());
    // specs/004 FR-018 (amendée révision 6) / specs/007 FR-012: the field keeps the player's own
    // entered value (1300), not the mock's recalculated median (1000), even on the confirmed path.
    expect(input).toHaveValue('1 300');
  });

  it('sends no POST and restores the previous value when the confirmation is canceled (FR-007)', async () => {
    const fetchMock = vi.fn().mockImplementation((input: string, init?: RequestInit) => {
      if (isPost(input, init)) return Promise.resolve(new Response(JSON.stringify({ id: 'contribution-1' }), { status: 201 }));
      return Promise.resolve(
        new Response(JSON.stringify({ resourceId: 'resource-1', serverId: 'mikhal', medianAmountKamas: 1000, sampleSize: 2 }), { status: 200 }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    await enterCommunityMode();

    const input = await screen.findByPlaceholderText('Prix unitaire');
    await waitFor(() => expect(input).toHaveValue('1 000'));

    fireEvent.click(screen.getByRole('button', { name: 'Modifier ce prix' }));
    fireEvent.change(input, { target: { value: '1300' } });
    fireEvent.blur(input);

    fireEvent.click(await screen.findByRole('button', { name: 'Annuler' }));

    expect(fetchMock.mock.calls.every(([url, init]) => !isPost(url as string, init as RequestInit | undefined))).toBe(true);
    await waitFor(() => expect(screen.getByPlaceholderText('Prix unitaire')).toHaveValue('1 000'));
  });

  it('commits directly, without any confirmation, when the deviation is at or below 25% or no median is known yet', async () => {
    const postBodies: unknown[] = [];
    const fetchMock = vi.fn().mockImplementation((input: string, init?: RequestInit) => {
      if (isPost(input, init)) {
        postBodies.push(JSON.parse(init!.body as string));
        return Promise.resolve(new Response(JSON.stringify({ id: 'contribution-1' }), { status: 201 }));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ resourceId: 'resource-1', serverId: 'mikhal', medianAmountKamas: 1000, sampleSize: 2 }), { status: 200 }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    await enterCommunityMode();

    const input = await screen.findByPlaceholderText('Prix unitaire');
    await waitFor(() => expect(input).toHaveValue('1 000'));

    fireEvent.click(screen.getByRole('button', { name: 'Modifier ce prix' }));
    fireEvent.change(input, { target: { value: '1150' } });
    fireEvent.blur(input);

    await waitFor(() => expect(postBodies).toHaveLength(1));
    expect(postBodies[0]).toMatchObject({ amountKamas: 1150 });
    expect(screen.queryByText(/Prix habituel/)).not.toBeInTheDocument();
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
