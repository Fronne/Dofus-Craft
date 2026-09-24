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

  // Mode communautaire activé (src/domain/price-modes.ts, COMMUNITY_MODE_ENABLED) : les deux
  // boutons sont sélectionnables, le Mode communautaire étant celui actif par défaut pour un nouveau
  // joueur (specs/003, révision 2026-09-24) jusqu'à ce qu'il bascule explicitement.
  it('presents community mode as active by default and personal mode as selectable', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
    goToSettings();

    const personalOption = await screen.findByRole('button', { name: /mode personnel/i });
    expect(personalOption).toHaveTextContent('Utiliser uniquement mes prix');
    expect(personalOption).toHaveAttribute('aria-pressed', 'false');
    expect(personalOption).not.toBeDisabled();

    const communityOption = screen.getByRole('button', { name: /mode communautaire/i });
    expect(communityOption).not.toBeDisabled();
    expect(communityOption).not.toHaveTextContent('Bientôt disponible');
    expect(communityOption).toHaveAttribute('aria-pressed', 'true');
  });

  it('activates community mode when its button is clicked', async () => {
    window.localStorage.setItem('craftcheck-price-mode-choice', 'personal');
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
    goToSettings();

    const communityOption = await screen.findByRole('button', { name: /mode communautaire/i });
    expect(communityOption).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(communityOption);

    expect(screen.getByRole('button', { name: /mode personnel/i })).toHaveAttribute('aria-pressed', 'false');
    expect(communityOption).toHaveAttribute('aria-pressed', 'true');
  });

  it('exposes exactly the two known modes, both active/selectable', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
    goToSettings();

    await screen.findByRole('button', { name: /mode personnel/i });
    expect(screen.getAllByRole('button', { name: /mode (personnel|communautaire)/i })).toHaveLength(2);
  });

  it('resolves to community mode by default and never blocks access to the rest of the application', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mikhal' }));
    goToSettings();

    expect(await screen.findByRole('button', { name: /^Mode communautaire/i })).toHaveAttribute('aria-pressed', 'true');

    // Navigating away from Paramètres and back to the search workspace remains unrestricted.
    fireEvent.click(screen.getByRole('link', { name: 'Recherche' }));
    expect(await screen.findByPlaceholderText('Rechercher un objet ou une panoplie...')).toBeInTheDocument();
  });
});
