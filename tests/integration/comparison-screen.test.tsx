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

describe('comparison screen', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('discards an unvalidated resource price input rather than carrying it over when the server changes (FR-018)', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));

    const priceInput = await screen.findByPlaceholderText('Prix unitaire');
    fireEvent.change(priceInput, { target: { value: 'abc' } });
    expect(priceInput).toHaveValue('abc');
    expect(priceInput).toHaveAttribute('aria-invalid', 'true');

    fireEvent.click(screen.getByRole('button', { name: /Serveur actif/i }));
    fireEvent.click(screen.getByRole('option', { name: 'Dakal' }));

    await waitFor(() => expect(screen.getByPlaceholderText('Prix unitaire')).toHaveValue(''));
  });
});
