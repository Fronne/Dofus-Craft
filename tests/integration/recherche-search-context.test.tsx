import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/data/catalogue-repository', () => ({
  getCategories: vi.fn().mockResolvedValue([]),
  searchItems: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getItemDetail: vi.fn(),
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

describe('Recherche page search context', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('keeps the search query after navigating to another page and back', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));

    const search = await screen.findByPlaceholderText('Rechercher un objet ou une panoplie...');
    fireEvent.change(search, { target: { value: 'Bouftou' } });
    expect(search).toHaveValue('Bouftou');

    fireEvent.click(screen.getByRole('link', { name: 'Paramètres' }));
    await screen.findByRole('heading', { name: 'Paramètres' });

    fireEvent.click(screen.getByRole('link', { name: 'Recherche' }));
    const searchAfterReturn = await screen.findByPlaceholderText('Rechercher un objet ou une panoplie...');
    expect(searchAfterReturn).toHaveValue('Bouftou');
  });
});
