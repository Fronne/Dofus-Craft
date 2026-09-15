import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/data/catalogue-repository', () => ({
  getCategories: vi.fn().mockResolvedValue([]),
  searchItems: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getItemDetail: vi.fn().mockResolvedValue({ resources: [] }),
  preloadCatalogueIndexes: vi.fn(),
  getManifest: vi.fn().mockReturnValue({
    sourceName: 'test',
    sourceVersion: '1',
    catalogueVersion: '1',
    publishedAt: new Date().toISOString(),
  }),
}));

import App from '../../src/app/App';

describe('server onboarding', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('blocks the rest of the application until a server is chosen', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Choisissez votre serveur' })).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText('Rechercher un objet ou une panoplie...'),
    ).not.toBeInTheDocument();
  });

  it('shows the blocking selector when storage is unavailable, exactly like a first visit (FR-017)', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError: storage is disabled');
    });

    render(<App />);

    expect(screen.getByRole('heading', { name: 'Choisissez votre serveur' })).toBeInTheDocument();

    getItemSpy.mockRestore();
  });

  it('memorizes the chosen server and unlocks the rest of the application', async () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Mikhal' }));

    expect(
      screen.queryByRole('heading', { name: 'Choisissez votre serveur' }),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('Rechercher un objet ou une panoplie...'),
      ).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Serveur actif')).toHaveValue('mikhal');
  });
});
