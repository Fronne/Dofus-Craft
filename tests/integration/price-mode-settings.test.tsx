import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/data/catalogue-repository', () => ({
  getCategories: vi.fn().mockResolvedValue([]),
  searchItems: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getItemDetail: vi.fn(),
  preloadCatalogueIndexes: vi.fn(),
  getManifest: vi.fn().mockReturnValue({
    sourceName: 'test',
    sourceVersion: '1',
    catalogueVersion: '1',
    publishedAt: new Date().toISOString(),
  }),
}));

import App from '../../src/app/App';

function goToSettings() {
  fireEvent.click(screen.getByRole('link', { name: 'Paramètres' }));
}

describe('price mode settings selector', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('presents both modes with their explanation and identifies personal as active by default', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Mikhal' }));
    goToSettings();

    const personalOption = await screen.findByRole('button', { name: /mode personnel/i });
    const communityOption = screen.getByRole('button', { name: /mode communautaire/i });

    expect(personalOption).toHaveTextContent('Utiliser uniquement mes prix');
    expect(communityOption).toHaveTextContent('Consulter les prix de la communauté');
    expect(personalOption).toHaveAttribute('aria-pressed', 'true');
    expect(communityOption).toHaveAttribute('aria-pressed', 'false');
  });

  it('makes the community mode the identified active mode once selected', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Mikhal' }));
    goToSettings();

    fireEvent.click(await screen.findByRole('button', { name: /mode communautaire/i }));

    expect(screen.getByRole('button', { name: /mode communautaire/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /mode personnel/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('never exposes more than the two modes', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Mikhal' }));
    goToSettings();

    await screen.findByRole('button', { name: /mode personnel/i });
    expect(screen.getAllByRole('button', { name: /mode (personnel|communautaire)/i })).toHaveLength(2);
  });

  it('resolves to personal mode by default and never blocks access to the rest of the application', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Mikhal' }));
    goToSettings();

    expect(await screen.findByRole('button', { name: /^Mode personnel/i })).toHaveAttribute('aria-pressed', 'true');

    // Navigating away from Paramètres and back to the search workspace remains unrestricted.
    fireEvent.click(screen.getByRole('link', { name: 'Recherche' }));
    expect(await screen.findByPlaceholderText('Rechercher un objet ou une panoplie...')).toBeInTheDocument();
  });
});
