import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SITE_SETTINGS as ALL_PAGES } from '../../src/domain/site-settings';

const getSiteSettings = vi.hoisted(() => vi.fn());
vi.mock('../../src/services/site-settings-api', () => ({ getSiteSettings }));
// The pages themselves are not the subject: only which one the shell shows.
vi.mock('../../src/features/hdv/HdvPage', () => ({ HdvPage: () => <h1>Page HDV</h1> }));
vi.mock('../../src/features/search/RecherchePage', () => ({ RecherchePage: () => <h1>Page Recherche</h1> }));
vi.mock('../../src/components/InfoBanner', () => ({ InfoBanner: () => null }));
vi.mock('../../src/features/dungeon-counter/DungeonCounterBubble', () => ({ PlayerCounters: () => null }));
vi.mock('../../src/features/server/ServerSwitcher', () => ({ ServerSwitcher: () => null }));
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
}

const hdvLink = () => screen.queryByRole('link', { name: 'HDV' });

// specs/053-hdv-page-toggle: the HDV page follows the owner's setting, enabled unless turned off.
describe('page HDV activée ou désactivée (specs/053)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    getSiteSettings.mockReset();
  });
  afterEach(cleanup);

  it('hides the link and says the page is unavailable while it is disabled (US2)', async () => {
    getSiteSettings.mockResolvedValue({ ...ALL_PAGES, forgemagiePage: false, hdvPage: false });
    open('/hdv');
    expect(await screen.findByText('HDV est momentanément indisponible')).toBeInTheDocument();
    expect(hdvLink()).not.toBeInTheDocument();
    expect(screen.getByText('La page reviendra bientôt. Vos prix sont conservés.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Aller à la recherche' })).toHaveAttribute('href', '/');
    expect(screen.queryByText('Page HDV')).not.toBeInTheDocument();
  });

  it('shows the link and the page while it is enabled, and remembers the settings (US2)', async () => {
    getSiteSettings.mockResolvedValue({ ...ALL_PAGES, forgemagiePage: false, hdvPage: true });
    open('/hdv');
    await waitFor(() => expect(getSiteSettings).toHaveBeenCalled());
    expect(screen.getByText('Page HDV')).toBeInTheDocument();
    expect(hdvLink()).toBeInTheDocument();
    await waitFor(() => expect(JSON.parse(window.localStorage.getItem('craftcheck-site-settings') as string)).toEqual({ ...ALL_PAGES, forgemagiePage: false, hdvPage: true }));
  });

  it('shows the page on a new device while the setting is still being read (FR-002)', () => {
    getSiteSettings.mockReturnValue(new Promise(() => {}));
    open('/hdv');
    expect(screen.getByText('Page HDV')).toBeInTheDocument();
    expect(hdvLink()).toBeInTheDocument();
  });

  it('waits rather than show the page, on a device that knew it disabled, while reading', () => {
    window.localStorage.setItem('craftcheck-site-settings', JSON.stringify({ ...ALL_PAGES, forgemagiePage: false, hdvPage: false }));
    getSiteSettings.mockReturnValue(new Promise(() => {}));
    open('/hdv');
    expect(screen.getByText('Chargement…')).toBeInTheDocument();
    expect(screen.queryByText('Page HDV')).not.toBeInTheDocument();
    expect(hdvLink()).not.toBeInTheDocument();
  });

  it('keeps the page hidden when the device knew it disabled and the setting cannot be read (US3)', async () => {
    window.localStorage.setItem('craftcheck-site-settings', JSON.stringify({ ...ALL_PAGES, forgemagiePage: false, hdvPage: false }));
    getSiteSettings.mockResolvedValue(undefined);
    open('/hdv');
    expect(await screen.findByText('HDV est momentanément indisponible')).toBeInTheDocument();
    expect(hdvLink()).not.toBeInTheDocument();
  });

  it('shows the page when settings kept before specs/053 have no HDV value and cannot be read again (US3)', async () => {
    window.localStorage.setItem('craftcheck-site-settings', JSON.stringify({ forgemagiePage: true }));
    getSiteSettings.mockResolvedValue(undefined);
    open('/hdv');
    await waitFor(() => expect(getSiteSettings).toHaveBeenCalled());
    expect(screen.getByText('Page HDV')).toBeInTheDocument();
    expect(hdvLink()).toBeInTheDocument();
  });

  it('shows the page when the setting cannot be read and none is known (US3)', async () => {
    getSiteSettings.mockResolvedValue(undefined);
    open('/hdv');
    await waitFor(() => expect(getSiteSettings).toHaveBeenCalled());
    expect(screen.getByText('Page HDV')).toBeInTheDocument();
  });
});
