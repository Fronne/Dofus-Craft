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

describe('the two price carnets are strictly independent (specs/004-community-price-sharing US2)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    // These scenarios are about Mode personnel, no longer the default for a new player.
    window.localStorage.setItem('craftcheck-price-mode-choice', 'personal');
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

    const personalInputBefore = await screen.findByPlaceholderText('Prix unitaire');
    fireEvent.change(personalInputBefore, { target: { value: '1000' } });
    await waitFor(() => expect(screen.getByText(/Coût de craft/)).toHaveTextContent('1 000'));
    // Persistence (and therefore this test's ability to tell the two carnets apart) only happens
    // once the field is blurred, same convention as comparison-screen.test.tsx.
    fireEvent.blur(personalInputBefore);

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

    const personalInputBefore = await screen.findByPlaceholderText('Prix unitaire');
    fireEvent.change(personalInputBefore, { target: { value: '1000' } });
    await waitFor(() => expect(screen.getByText(/Coût de craft/)).toHaveTextContent('1 000'));
    // Persistence only happens once the field is blurred, same convention as
    // comparison-screen.test.tsx — without this, the personal price is never actually written to
    // its carnet and the later reassertion below would fail for an unrelated reason.
    fireEvent.blur(personalInputBefore);

    goToSettings();
    fireEvent.click(await screen.findByRole('button', { name: /mode communautaire/i }));
    goToSearch();

    const communityInput = await screen.findByPlaceholderText('Prix unitaire');
    await waitFor(() => expect(communityInput).toHaveValue('5 000'));
    // 9000 vs. the 5000 median deviates by 80% (> specs/007's 25% threshold): change it within
    // the community-mode carnet only to demonstrate the isolation from Mode personnel, without
    // this test needing to also interact with the (unrelated) outlier confirmation dialog.
    fireEvent.change(communityInput, { target: { value: '5500' } });
    await waitFor(() => expect(screen.getByText(/Coût de craft/)).toHaveTextContent('5 500'));

    goToSettings();
    fireEvent.click(await screen.findByRole('button', { name: /mode personnel/i }));
    goToSearch();

    const personalInput = await screen.findByPlaceholderText('Prix unitaire');
    await waitFor(() => expect(personalInput).toHaveValue('1 000'));
    expect(screen.getByText(/Coût de craft/)).toHaveTextContent('1 000');
  });
});
