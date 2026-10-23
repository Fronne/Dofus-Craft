import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SITE_SETTINGS, SITE_PAGES, type SiteSettings } from '../../src/domain/site-settings';

const getSiteSettings = vi.hoisted(() => vi.fn());
vi.mock('../../src/services/site-settings-api', () => ({ getSiteSettings }));
// The pages themselves are not the subject: only which one the shell shows.
vi.mock('../../src/features/search/RecherchePage', () => ({ RecherchePage: () => <h1>Contenu Recherche</h1> }));
vi.mock('../../src/features/catalogue/EpinglesPage', () => ({ EpinglesPage: () => <h1>Contenu Suivis</h1> }));
vi.mock('../../src/features/prices/PricesPage', () => ({ PricesPage: () => <h1>Contenu Rentabilité</h1> }));
vi.mock('../../src/features/hdv/HdvPage', () => ({ HdvPage: () => <h1>Contenu HDV</h1> }));
vi.mock('../../src/features/pets/FamilierPage', () => ({ FamilierPage: () => <h1>Contenu XP Familier</h1> }));
vi.mock('../../src/features/forgemagie/ForgemagiePage', () => ({ ForgemagiePage: () => <h1>Contenu Forgemagie</h1> }));
vi.mock('../../src/features/brisage/BrisagePage', () => ({ BrisagePage: () => <h1>Contenu Brisage</h1> }));
vi.mock('../../src/features/settings/ParametresPage', () => ({ ParametresPage: () => <h1>Contenu Paramètres</h1> }));
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

const PATHS: Record<string, string> = {
  Recherche: '/', Suivis: '/suivis', Rentabilité: '/rentabilite', HDV: '/hdv', 'XP Familier': '/familier', Forgemagie: '/forgemagie', Brisage: '/brisage',
};
const settings = (overrides: Partial<SiteSettings>): SiteSettings => ({ ...DEFAULT_SITE_SETTINGS, forgemagiePage: true, ...overrides });
const allOff = Object.fromEntries(SITE_PAGES.map((page) => [page.field, false])) as SiteSettings;
const navLink = (name: string) => screen.queryByRole('link', { name });

// specs/071-admin-dashboard-moderne (FR-001 to FR-007): every page of the navigation follows the owner's setting.
describe('les sept pages activées ou désactivées (specs/071)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    getSiteSettings.mockReset();
  });
  afterEach(cleanup);

  it.each(SITE_PAGES.map((page) => [page.label, page.field] as const))(
    '%s désactivée : son lien disparaît et son adresse dit « momentanément indisponible »',
    async (label, field) => {
      getSiteSettings.mockResolvedValue(settings({ [field]: false }));
      open(PATHS[label]);
      expect(await screen.findByText(`${label} est momentanément indisponible`)).toBeInTheDocument();
      expect(navLink(label)).not.toBeInTheDocument();
      expect(screen.queryByText(`Contenu ${label}`)).not.toBeInTheDocument();
      // The way out is a page that is still on, and the six others keep their links.
      expect(screen.getByRole('link', { name: /^Aller à / })).toBeInTheDocument();
      for (const other of Object.keys(PATHS).filter((name) => name !== label)) expect(navLink(other)).toBeInTheDocument();
    },
  );

  it.each(SITE_PAGES.map((page) => [page.label] as const))('%s activée : sa page s\'affiche avec son lien', async (label) => {
    getSiteSettings.mockResolvedValue(settings({}));
    open(PATHS[label]);
    expect(await screen.findByText(`Contenu ${label}`)).toBeInTheDocument();
    expect(navLink(label)).toBeInTheDocument();
  });

  it('la page Paramètres reste toujours accessible, même sans aucune page active', async () => {
    getSiteSettings.mockResolvedValue(allOff);
    open('/parametres');
    expect(await screen.findByText('Contenu Paramètres')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Paramètres' })).toBeInTheDocument();
  });

  it('mène l\'accueil, le logo et le lien de repli à la première page encore active quand Recherche est coupée', async () => {
    getSiteSettings.mockResolvedValue(settings({ searchPage: false }));
    open('/accueil');
    expect(await screen.findByText('Contenu Suivis')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'DofusCraft, aller à Suivis' })).toHaveAttribute('href', '/suivis');
    cleanup();
    open('/');
    expect(await screen.findByText('Recherche est momentanément indisponible')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Aller à Suivis' })).toHaveAttribute('href', '/suivis');
  });

  it('garde « Aller à la recherche » tant que la recherche est active', async () => {
    getSiteSettings.mockResolvedValue(settings({ brisagePage: false }));
    open('/brisage');
    expect(await screen.findByText('Brisage est momentanément indisponible')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Aller à la recherche' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'DofusCraft, aller à la recherche' })).toHaveAttribute('href', '/');
  });

  it('dit qu\'aucune page n\'est disponible quand toutes sont coupées, avec un lien vers les paramètres', async () => {
    getSiteSettings.mockResolvedValue(allOff);
    open('/');
    expect(await screen.findByText('Aucune page n\'est disponible pour le moment')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ouvrir les paramètres' })).toHaveAttribute('href', '/parametres');
    for (const label of Object.keys(PATHS)) expect(navLink(label)).not.toBeInTheDocument();
    cleanup();
    open('/accueil');
    expect(await screen.findByText('Aucune page n\'est disponible pour le moment')).toBeInTheDocument();
    cleanup();
    open('/adresse-inconnue');
    expect(await screen.findByText('Aucune page n\'est disponible pour le moment')).toBeInTheDocument();
  });

  it('mène une adresse inconnue à une page encore active', async () => {
    getSiteSettings.mockResolvedValue(settings({}));
    open('/adresse-inconnue');
    expect(await screen.findByText('Cette adresse n\'existe pas')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Aller à la recherche' })).toHaveAttribute('href', '/');
  });

  it('applique la page cible d\'une ancienne adresse : /epingles passe par Suivis, désactivée ou non', async () => {
    getSiteSettings.mockResolvedValue(settings({ pinnedPage: false }));
    open('/epingles');
    expect(await screen.findByText('Suivis est momentanément indisponible')).toBeInTheDocument();
  });

  it('dit « Chargement… » pendant la première lecture d\'une page coupée, jamais « indisponible » à tort', async () => {
    window.localStorage.setItem('craftcheck-site-settings', JSON.stringify(settings({ brisagePage: false })));
    getSiteSettings.mockReturnValue(new Promise(() => {}));
    open('/brisage');
    expect(await screen.findByText('Chargement…')).toBeInTheDocument();
    expect(screen.queryByText('Brisage est momentanément indisponible')).not.toBeInTheDocument();
  });

  it('lit un cache local d\'avant la fonctionnalité sans désactiver aucune page', async () => {
    window.localStorage.setItem('craftcheck-site-settings', JSON.stringify({ forgemagiePage: false, hdvPage: true }));
    getSiteSettings.mockReturnValue(new Promise(() => {}));
    open('/brisage');
    expect(await screen.findByText('Contenu Brisage')).toBeInTheDocument();
    for (const label of ['Recherche', 'Suivis', 'Rentabilité', 'HDV', 'XP Familier', 'Brisage']) expect(navLink(label)).toBeInTheDocument();
    expect(navLink('Forgemagie')).not.toBeInTheDocument();
  });

  it('suit un changement du service : la page coupée redevient accessible', async () => {
    getSiteSettings.mockResolvedValue(settings({ petsPage: false }));
    open('/familier');
    expect(await screen.findByText('XP Familier est momentanément indisponible')).toBeInTheDocument();
    cleanup();
    getSiteSettings.mockResolvedValue(settings({}));
    open('/familier');
    await waitFor(() => expect(screen.getByText('Contenu XP Familier')).toBeInTheDocument());
  });
});
