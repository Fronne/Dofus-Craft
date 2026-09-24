import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let resolveCatalogueReady: () => void = () => undefined;

vi.mock('../../src/data/catalogue-repository', () => ({
  getCategories: vi.fn().mockResolvedValue([]),
  searchItems: vi.fn().mockResolvedValue({
    data: [{ id: 'item-1', name: 'Épée Boueuse', level: 1, kind: 'Equipment', categoryId: 'cat-1' }],
    total: 21,
  }),
  getItemDetail: vi.fn().mockResolvedValue({ resources: [] }),
  preloadCatalogueIndexes: vi.fn(),
  whenCatalogueReady: vi.fn(() => new Promise<void>((resolve) => {
    resolveCatalogueReady = resolve;
  })),
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

describe('Recherche results total while the catalogue warms up', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows a loading indicator instead of a capped count, then the total once the catalogue is ready', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));

    await screen.findByText('Épée Boueuse');
    expect(screen.getByText('Mise à jour…')).toBeInTheDocument();
    expect(screen.queryByText('21 objets trouvés')).not.toBeInTheDocument();

    resolveCatalogueReady();
    await waitFor(() => expect(screen.getByText('21 objets trouvés')).toBeInTheDocument());

    // The catalogue becoming ready also triggers useCatalogue's debounced (250ms) search
    // effect to refetch. Let that timer fire here, inside the test's own jsdom environment,
    // instead of leaking a setState-after-teardown into whichever test runs next.
    // That refetch briefly shows "Mise à jour…" in the count's spot again; once it settles, only the
    // total remains.
    await new Promise((resolve) => setTimeout(resolve, 350));
    await waitFor(() => expect(screen.queryByText('Mise à jour…')).not.toBeInTheDocument());
    expect(screen.getByText('21 objets trouvés')).toBeInTheDocument();
  });
});
