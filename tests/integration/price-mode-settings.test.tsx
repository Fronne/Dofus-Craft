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
    fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
    goToSettings();

    const personalOption = await screen.findByRole('button', { name: /mode personnel/i });
    const communityOption = screen.getByRole('button', { name: /mode communautaire/i });

    expect(personalOption).toHaveTextContent('Utiliser uniquement mes prix');
    expect(communityOption).toHaveTextContent('Consulter les prix communautaires');
    expect(personalOption).toHaveAttribute('aria-pressed', 'true');
    expect(communityOption).toHaveAttribute('aria-pressed', 'false');
  });

  it('lets the player select community mode, which becomes active (specs/004-community-price-sharing)', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
    goToSettings();

    const communityOption = await screen.findByRole('button', { name: /mode communautaire/i });
    expect(communityOption).not.toBeDisabled();

    fireEvent.click(communityOption);

    expect(screen.getByRole('button', { name: /mode communautaire/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /mode personnel/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('never exposes more than the two modes', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
    goToSettings();

    await screen.findByRole('button', { name: /mode personnel/i });
    expect(screen.getAllByRole('button', { name: /mode (personnel|communautaire)/i })).toHaveLength(2);
  });

  it('resolves to personal mode by default and never blocks access to the rest of the application', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
    goToSettings();

    expect(await screen.findByRole('button', { name: /^Mode personnel/i })).toHaveAttribute('aria-pressed', 'true');

    // Navigating away from Paramètres and back to the search workspace remains unrestricted.
    fireEvent.click(screen.getByRole('link', { name: 'Recherche' }));
    expect(await screen.findByPlaceholderText('Rechercher un objet ou une panoplie...')).toBeInTheDocument();
  });
});
