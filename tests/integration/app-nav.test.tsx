import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SITE_SETTINGS as ALL_PAGES } from '../../src/domain/site-settings';

const getSiteSettings = vi.hoisted(() => vi.fn());
vi.mock('../../src/services/site-settings-api', () => ({ getSiteSettings }));
// The pages themselves are not the subject: only the navigation around them.
vi.mock('../../src/features/search/RecherchePage', () => ({ RecherchePage: () => <h1>Page Recherche</h1> }));
vi.mock('../../src/features/prices/PricesPage', () => ({ PricesPage: () => <h1>Page Rentabilité</h1> }));
vi.mock('../../src/components/InfoBanner', () => ({ InfoBanner: () => null }));
vi.mock('../../src/features/dungeon-counter/DungeonCounterBubble', () => ({ PlayerCounters: () => null }));
vi.mock('../../src/features/server/ServerSwitcher', () => ({ ServerSwitcher: () => <button type="button">Serveur actif Mikhal</button> }));
vi.mock('../../src/features/server/PinnedPriceMigrationNotice', () => ({ PinnedPriceMigrationNotice: () => null }));
vi.mock('../../src/features/prices/useCraftProfits', () => ({ preloadCraftProfits: () => () => {} }));
vi.mock('../../src/services/visit-api', () => ({ recordVisit: vi.fn() }));
vi.mock('../../src/app/ServerContext', () => ({ useActiveServer: () => ({ serverId: 'mikhal' }) }));

import { AppShell } from '../../src/app/AppShell';

function open(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AppShell />
    </MemoryRouter>,
  );
  return screen.getByRole('navigation', { name: 'Navigation principale' });
}

// What the navigation holds, in reading order (links and buttons).
function entries(nav: HTMLElement) {
  return [...nav.querySelectorAll('a, button')].map((entry) => entry.getAttribute('aria-label') ?? entry.textContent);
}

// specs/051-site-visual-refresh (US2): the same entries as before, in the order of the top bar.
describe('navigation principale (specs/051)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem('craftcheck-theme', 'dark');
    getSiteSettings.mockReset();
  });
  afterEach(cleanup);

  it('lists the pages, then the active server, Paramètres and the theme toggle', async () => {
    getSiteSettings.mockResolvedValue({ ...ALL_PAGES, forgemagiePage: true, hdvPage: true });
    const nav = open('/');
    await within(nav).findByRole('link', { name: 'Forgemagie' });
    expect(nav).toHaveTextContent(/^DofusCraft/);
    expect(entries(nav)).toEqual([
      'DofusCraft, aller à la recherche',
      'Recherche', 'Suivis', 'Rentabilité', 'HDV', 'XP Familier', 'Forgemagie', 'Brisage',
      'Serveur actif Mikhal',
      'Communauté, prix partagés avec le groupe', 'Perso, prix gardés sur cet appareil',
      'Paramètres', 'Activer le thème clair',
    ]);
  });

  it('switches the price mode in one click from the bar', async () => {
    getSiteSettings.mockResolvedValue({ ...ALL_PAGES, forgemagiePage: true, hdvPage: true });
    const nav = open('/');
    await within(nav).findByRole('link', { name: 'Forgemagie' });
    const community = within(nav).getByRole('button', { name: /Communauté/ });
    const personal = within(nav).getByRole('button', { name: /Perso/ });
    expect(community).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(personal);
    expect(personal).toHaveAttribute('aria-pressed', 'true');
    expect(community).toHaveAttribute('aria-pressed', 'false');
    // The change is confirmed in a toast, and the page badge follows the mode.
    expect(screen.getByText(/Mode personnel activé/)).toBeInTheDocument();
    expect(screen.getByText('Prix personnels')).toBeInTheDocument();
  });

  it('shows no mode toast on load, and no mode badge on Paramètres', async () => {
    getSiteSettings.mockResolvedValue({ ...ALL_PAGES, forgemagiePage: true, hdvPage: true });
    const nav = open('/');
    await within(nav).findByRole('link', { name: 'Forgemagie' });
    expect(screen.queryByText(/Mode (personnel|communautaire) activé/)).not.toBeInTheDocument();
    expect(screen.getByText('Prix communautaires')).toBeInTheDocument();
    cleanup();
    open('/parametres');
    expect(screen.queryByText('Prix communautaires')).not.toBeInTheDocument();
  });

  it('marks the page being shown, and only that one', async () => {
    getSiteSettings.mockResolvedValue({ ...ALL_PAGES, forgemagiePage: false, hdvPage: true });
    const nav = open('/rentabilite');
    expect(await screen.findByText('Page Rentabilité')).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: 'Rentabilité' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Recherche' })).not.toHaveAttribute('aria-current');
  });

  it('leaves Forgemagie out while the page is disabled', async () => {
    getSiteSettings.mockResolvedValue({ ...ALL_PAGES, forgemagiePage: false, hdvPage: true });
    const nav = open('/');
    await waitFor(() => expect(getSiteSettings).toHaveBeenCalled());
    expect(entries(nav)).not.toContain('Forgemagie');
  });

  it('leaves HDV out while the page is disabled (specs/053)', async () => {
    getSiteSettings.mockResolvedValue({ ...ALL_PAGES, forgemagiePage: true, hdvPage: false });
    const nav = open('/');
    await within(nav).findByRole('link', { name: 'Forgemagie' });
    expect(entries(nav)).not.toContain('HDV');
  });

  it('keeps « Aller au contenu » as the first thing reached with the keyboard', () => {
    getSiteSettings.mockResolvedValue({ ...ALL_PAGES, forgemagiePage: false, hdvPage: true });
    open('/');
    const first = document.querySelector('a, button');
    expect(first).toHaveTextContent('Aller au contenu');
    expect(first).toHaveAttribute('href', '#contenu');
  });
});
