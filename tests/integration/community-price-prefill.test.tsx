import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import type { CommunityPriceLookup } from '../../src/services/community-price-api';

const getCommunityPrice = vi.fn<(resourceId: string, serverId: string) => Promise<CommunityPriceLookup>>();
const submitCommunityPrice = vi.fn<(resourceId: string, serverId: string, amountKamas: number) => Promise<{ id: string } | undefined>>();

vi.mock('../../src/services/community-price-api', () => ({
  getCommunityPrice: (resourceId: string, serverId: string) => getCommunityPrice(resourceId, serverId),
  submitCommunityPrice: (resourceId: string, serverId: string, amountKamas: number) =>
    submitCommunityPrice(resourceId, serverId, amountKamas),
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

describe('community price prefill in Mode communautaire (specs/004-community-price-sharing US1)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    globalThis.indexedDB = new IDBFactory();
    getCommunityPrice.mockReset();
    submitCommunityPrice.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('pre-fills the price field with the community median when the carnet has no entry yet (FR-001)', async () => {
    getCommunityPrice.mockResolvedValue({
      status: 'found',
      price: { resourceId: 'resource-1', serverId: 'mikhal', medianAmountKamas: 5000, sampleSize: 3 },
    });

    render(<App />);
    await enterCommunityMode();

    const input = await screen.findByPlaceholderText('Prix unitaire');
    await waitFor(() => expect(input).toHaveValue('5 000'));
    expect(input).not.toBeDisabled();
    // FR-017: pre-filling never submits anything by itself — only a confirmed edit does (see the
    // dedicated test below).
    expect(submitCommunityPrice).not.toHaveBeenCalled();
  });

  it('leaves the field empty and directly fillable when no community price exists (FR-002)', async () => {
    getCommunityPrice.mockResolvedValue({ status: 'not-found' });

    render(<App />);
    await enterCommunityMode();

    const input = await screen.findByPlaceholderText('Prix unitaire');
    await waitFor(() => expect(getCommunityPrice).toHaveBeenCalled());
    expect(input).toHaveValue('');
    expect(input).not.toBeDisabled();
  });

  it('uses an edited value immediately for the craft cost and keeps it across a remount (FR-004)', async () => {
    getCommunityPrice.mockResolvedValue({
      status: 'found',
      price: { resourceId: 'resource-1', serverId: 'mikhal', medianAmountKamas: 5000, sampleSize: 3 },
    });
    submitCommunityPrice.mockResolvedValue({ id: 'contribution-1' });

    const { unmount } = render(<App />);
    await enterCommunityMode();

    const input = await screen.findByPlaceholderText('Prix unitaire');
    await waitFor(() => expect(input).toHaveValue('5 000'));

    fireEvent.change(input, { target: { value: '7000' } });
    await waitFor(() => expect(screen.getByText(/Coût de craft/)).toHaveTextContent('7 000'));

    // 7000 vs. the 5000 median deviates by 40% (> specs/007's 25% threshold), so blurring gates
    // the commit behind the outlier confirmation dialog — accept it so the edit actually persists
    // to the community-mode carnet (via `onPersist`) before the remount below.
    fireEvent.blur(input);
    fireEvent.click(await screen.findByRole('button', { name: 'Enregistrer quand même' }));
    await waitFor(() => expect(submitCommunityPrice).toHaveBeenCalledWith('resource-1', 'mikhal', 7000));

    unmount();
    document.body.innerHTML = '';
    render(<App />);
    // Server selection and price mode both persisted (localStorage) — no onboarding/mode toggle
    // to repeat, just navigate straight to Recherche.
    fireEvent.click(await screen.findByRole('link', { name: 'Recherche' }));

    const reopenedInput = await screen.findByPlaceholderText('Prix unitaire');
    await waitFor(() => expect(reopenedInput).toHaveValue('7 000'));
  });

  it('never lets an automatic refresh overwrite a price already present in the community-mode carnet (FR-006)', async () => {
    getCommunityPrice.mockResolvedValue({
      status: 'found',
      price: { resourceId: 'resource-1', serverId: 'mikhal', medianAmountKamas: 5000, sampleSize: 3 },
    });

    render(<App />);
    await enterCommunityMode();

    const input = await screen.findByPlaceholderText('Prix unitaire');
    await waitFor(() => expect(input).toHaveValue('5 000'));
    const callsBeforeRefresh = getCommunityPrice.mock.calls.length;

    // The community median changes, but the carnet already holds a value for this resource. A
    // mode round trip unmounts/remounts the price row, forcing a fresh fetch — the same effect a
    // background 5-minute refresh (FR-014) would have, without needing to fake real time alongside
    // fake-indexeddb's own internal scheduling.
    getCommunityPrice.mockResolvedValue({
      status: 'found',
      price: { resourceId: 'resource-1', serverId: 'mikhal', medianAmountKamas: 9000, sampleSize: 5 },
    });

    fireEvent.click(screen.getByRole('link', { name: 'Paramètres' }));
    fireEvent.click(await screen.findByRole('button', { name: /mode personnel/i }));
    fireEvent.click(await screen.findByRole('button', { name: /mode communautaire/i }));
    fireEvent.click(screen.getByRole('link', { name: 'Recherche' }));

    await waitFor(() => expect(getCommunityPrice.mock.calls.length).toBeGreaterThan(callsBeforeRefresh));
    // specs/010-search-instant-cache: the remounted row's own carnet reload (useResourcePrices) and
    // the community median refresh are two independent async operations that no longer share a
    // synchronous "reset to empty" checkpoint — give the carnet reload room to resolve too, instead
    // of asserting on it just because the median call count already ticked up.
    await waitFor(() => expect(screen.getByPlaceholderText('Prix unitaire')).toHaveValue('5 000'));
  });

  // specs/004-community-price-sharing (révision 4, amendée par specs/007 FR-012) : confirming an
  // edit (perte de focus après changement) submits it and refreshes the community metadata
  // (contribution count), but — since the field must never be overwritten with a recalculated
  // value the player didn't type — it keeps displaying exactly what the player entered. The typed
  // value (6000) stays within specs/007's 25% outlier threshold of the 5000 median, so no
  // confirmation dialog gets in the way here (that gate is covered separately by
  // outlier-threshold/community-price-outlier unit tests and OutlierConfirmDialog's own tests).
  it('submits a confirmed edit, keeps the field at the typed value, and refreshes the contribution count (FR-017/FR-018/FR-019)', async () => {
    getCommunityPrice.mockResolvedValueOnce({
      status: 'found',
      price: { resourceId: 'resource-1', serverId: 'mikhal', medianAmountKamas: 5000, sampleSize: 3 },
    });
    submitCommunityPrice.mockResolvedValue({ id: 'contribution-1' });

    render(<App />);
    await enterCommunityMode();

    const input = await screen.findByPlaceholderText('Prix unitaire');
    await waitFor(() => expect(input).toHaveValue('5 000'));
    expect(screen.getByText(/3 contributions/)).toBeInTheDocument();

    // After the submission succeeds, the next getCommunityPrice call (the refresh) returns the
    // updated median/sampleSize including this new contribution.
    getCommunityPrice.mockResolvedValue({
      status: 'found',
      price: { resourceId: 'resource-1', serverId: 'mikhal', medianAmountKamas: 5500, sampleSize: 4 },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Modifier ce prix' }));
    fireEvent.change(input, { target: { value: '6000' } });
    fireEvent.blur(input);

    await waitFor(() => expect(submitCommunityPrice).toHaveBeenCalledWith('resource-1', 'mikhal', 6000));
    await waitFor(() => expect(screen.getByText(/4 contributions/)).toBeInTheDocument());
    expect(input).toHaveValue('6 000');
  });

  // FR-020: a failed submission never loses the player's typed value, and never triggers a
  // follow-up refresh (which could otherwise overwrite it with a stale/unrelated median).
  it('keeps the locally typed value and does not refresh when a confirmed edit fails to submit (FR-020)', async () => {
    getCommunityPrice.mockResolvedValueOnce({
      status: 'found',
      price: { resourceId: 'resource-1', serverId: 'mikhal', medianAmountKamas: 5000, sampleSize: 3 },
    });
    submitCommunityPrice.mockResolvedValue(undefined);

    render(<App />);
    await enterCommunityMode();

    const input = await screen.findByPlaceholderText('Prix unitaire');
    await waitFor(() => expect(input).toHaveValue('5 000'));
    const callsBeforeCommit = getCommunityPrice.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: 'Modifier ce prix' }));
    fireEvent.change(input, { target: { value: '6000' } });
    fireEvent.blur(input);

    await waitFor(() => expect(submitCommunityPrice).toHaveBeenCalledWith('resource-1', 'mikhal', 6000));
    expect(screen.getByPlaceholderText('Prix unitaire')).toHaveValue('6 000');
    expect(getCommunityPrice.mock.calls.length).toBe(callsBeforeCommit);
  });
});
