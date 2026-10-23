import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SITE_SETTINGS as ALL_PAGES } from '../../src/domain/site-settings';

const getSiteSettings = vi.hoisted(() => vi.fn());
vi.mock('../../src/services/site-settings-api', () => ({ getSiteSettings }));
// The pages themselves are not the subject: only which one the shell shows.
vi.mock('../../src/features/forgemagie/ForgemagiePage', () => ({ ForgemagiePage: () => <h1>Page Forgemagie</h1> }));
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

const forgemagieLink = () => screen.queryByRole('link', { name: 'Forgemagie' });

// specs/050-forgemagie-page-toggle: the Forgemagie page follows the owner's setting.
describe('page Forgemagie activée ou désactivée (specs/050)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    getSiteSettings.mockReset();
  });
  afterEach(cleanup);

  it('hides the link and says the page is unavailable while it is disabled (US1)', async () => {
    getSiteSettings.mockResolvedValue({ ...ALL_PAGES, forgemagiePage: false, hdvPage: true });
    open('/forgemagie');
    await waitFor(() => expect(getSiteSettings).toHaveBeenCalled());
    expect(forgemagieLink()).not.toBeInTheDocument();
    expect(await screen.findByText('Forgemagie est momentanément indisponible')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Aller à la recherche' })).toHaveAttribute('href', '/');
    expect(screen.queryByText('Page Forgemagie')).not.toBeInTheDocument();
  });

  it('never shows the page while the setting is still being read on a new device', () => {
    getSiteSettings.mockReturnValue(new Promise(() => {}));
    open('/forgemagie');
    expect(forgemagieLink()).not.toBeInTheDocument();
    // …and does not call an enabled page unavailable before knowing.
    expect(screen.getByText('Chargement…')).toBeInTheDocument();
    expect(screen.queryByText('Forgemagie est momentanément indisponible')).not.toBeInTheDocument();
    expect(screen.queryByText('Page Forgemagie')).not.toBeInTheDocument();
  });

  it('brings the link and the page back once enabled, and remembers it (US2)', async () => {
    getSiteSettings.mockResolvedValue({ ...ALL_PAGES, forgemagiePage: true, hdvPage: true });
    open('/forgemagie');
    expect(await screen.findByText('Page Forgemagie')).toBeInTheDocument();
    expect(forgemagieLink()).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('craftcheck-site-settings') as string)).toEqual({ ...ALL_PAGES, forgemagiePage: true, hdvPage: true });
  });

  it('keeps the last known state when the setting cannot be read (US3)', async () => {
    window.localStorage.setItem('craftcheck-site-settings', JSON.stringify({ ...ALL_PAGES, forgemagiePage: true, hdvPage: true }));
    getSiteSettings.mockResolvedValue(undefined);
    open('/forgemagie');
    await waitFor(() => expect(getSiteSettings).toHaveBeenCalled());
    expect(screen.getByText('Page Forgemagie')).toBeInTheDocument();
    expect(forgemagieLink()).toBeInTheDocument();
  });

  it('keeps the page hidden when the setting cannot be read and none is known (US3)', async () => {
    getSiteSettings.mockResolvedValue(undefined);
    open('/forgemagie');
    await waitFor(() => expect(getSiteSettings).toHaveBeenCalled());
    expect(forgemagieLink()).not.toBeInTheDocument();
    expect(await screen.findByText('Forgemagie est momentanément indisponible')).toBeInTheDocument();
  });

  it('hides a page the device knew as enabled once the owner disabled it', async () => {
    window.localStorage.setItem('craftcheck-site-settings', JSON.stringify({ ...ALL_PAGES, forgemagiePage: true, hdvPage: true }));
    getSiteSettings.mockResolvedValue({ ...ALL_PAGES, forgemagiePage: false, hdvPage: true });
    open('/');
    await waitFor(() => expect(forgemagieLink()).not.toBeInTheDocument());
  });
});
