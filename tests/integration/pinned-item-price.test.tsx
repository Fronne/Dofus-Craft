import { IDBFactory } from 'fake-indexeddb';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  getManifest: vi.fn().mockReturnValue({
    sourceName: 'test',
    sourceVersion: '1',
    catalogueVersion: '1',
    publishedAt: new Date().toISOString(),
  }),
}));

import App from '../../src/app/App';

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
    fireEvent.click(screen.getByRole('button', { name: 'Mikhal' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Épingler' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Épingler' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Désépingler' })).toBeInTheDocument());

    const marketInput = screen.getByLabelText('Prix HDV observé');
    expect(marketInput).toHaveValue('');

    fireEvent.change(marketInput, { target: { value: '500000' } });
    await waitFor(() => expect(marketInput).toHaveValue('500 000'));

    fireEvent.change(screen.getByLabelText('Serveur actif'), { target: { value: 'dakal' } });

    const pinnedItemsPanel = screen.getByRole('region', { name: 'Items épinglés' });
    expect(within(pinnedItemsPanel).getByText('Épée Boueuse')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Prix HDV observé')).toHaveValue(''));

    fireEvent.change(screen.getByLabelText('Prix HDV observé'), { target: { value: '750000' } });
    await waitFor(() => expect(screen.getByLabelText('Prix HDV observé')).toHaveValue('750 000'));

    fireEvent.change(screen.getByLabelText('Serveur actif'), { target: { value: 'mikhal' } });
    await waitFor(() => expect(screen.getByLabelText('Prix HDV observé')).toHaveValue('500 000'));
    expect(screen.getByRole('button', { name: 'Désépingler' })).toBeInTheDocument();
  });
});
