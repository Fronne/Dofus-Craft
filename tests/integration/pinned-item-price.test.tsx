import { IDBFactory } from 'fake-indexeddb';
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
    { id: 'dakal', name: 'Dakal', type: 'mono' },
  ]),
}));

import App from '../../src/app/App';
import { pinnedItemPrices } from '../../src/persistence/indexeddb-pinned-item-price-repository';

describe('pinned item market price per server', () => {
  beforeEach(() => {
    window.localStorage.clear();
    globalThis.indexedDB = new IDBFactory();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('keeps the item pinned and isolates its market price when the active server changes', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Suivre' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Suivre' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Ne plus suivre' })).toBeInTheDocument());

    const marketInput = screen.getByLabelText('Prix HDV');
    expect(marketInput).toHaveValue('');

    fireEvent.change(marketInput, { target: { value: '500000' } });
    await waitFor(() => expect(marketInput).toHaveValue('500 000'));

    fireEvent.click(screen.getByRole('button', { name: /Serveur actif/i }));
    fireEvent.click(screen.getByRole('option', { name: 'Dakal' }));

    expect(screen.getByRole('button', { name: 'Ne plus suivre' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Prix HDV')).toHaveValue(''));

    fireEvent.change(screen.getByLabelText('Prix HDV'), { target: { value: '750000' } });
    await waitFor(() => expect(screen.getByLabelText('Prix HDV')).toHaveValue('750 000'));

    fireEvent.click(screen.getByRole('button', { name: /Serveur actif/i }));
    fireEvent.click(screen.getByRole('option', { name: 'Mikhal' }));
    await waitFor(() => expect(screen.getByLabelText('Prix HDV')).toHaveValue('500 000'));
    expect(screen.getByRole('button', { name: 'Ne plus suivre' })).toBeInTheDocument();
  });

  it('keeps the recorded market price after the item is unpinned, so the Prix page can still show it', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Suivre' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Suivre' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Ne plus suivre' })).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Prix HDV'), { target: { value: '500000' } });
    await waitFor(() => expect(screen.getByLabelText('Prix HDV')).toHaveValue('500 000'));

    fireEvent.click(screen.getByRole('button', { name: 'Ne plus suivre' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Suivre' })).toBeInTheDocument());

    expect(await pinnedItemPrices.get('mikhal', 'item-1')).toMatchObject({ marketPriceKamas: 500000 });
  });

  it('lets the user record a market price for an item that is not pinned', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));

    const marketInput = await screen.findByLabelText('Prix HDV');
    expect(screen.getByRole('button', { name: 'Suivre' })).toBeInTheDocument();

    fireEvent.change(marketInput, { target: { value: '500000' } });
    await waitFor(() => expect(marketInput).toHaveValue('500 000'));

    expect(await pinnedItemPrices.get('mikhal', 'item-1')).toMatchObject({ marketPriceKamas: 500000 });
  });

  it('only lets digits reach the market price field, silently dropping every other character typed', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));

    const marketInput = await screen.findByLabelText('Prix HDV');
    fireEvent.change(marketInput, { target: { value: '30°00' } });
    expect(marketInput).toHaveValue('3 000');

    await waitFor(async () => expect(await pinnedItemPrices.get('mikhal', 'item-1')).toMatchObject({ marketPriceKamas: 3000 }));
  });
});
