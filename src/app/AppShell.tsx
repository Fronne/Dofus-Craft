import { useEffect, useRef, useState } from 'react';
import { InfoBanner } from '../components/InfoBanner';
import { Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ROUTES } from './router';
import { Icon } from '../components/Icon';
import { ServerSwitcher } from '../features/server/ServerSwitcher';
import { PinnedPriceMigrationNotice } from '../features/server/PinnedPriceMigrationNotice';
import { RecherchePage } from '../features/search/RecherchePage';
import { EpinglesPage } from '../features/catalogue/EpinglesPage';
import { ParametresPage } from '../features/settings/ParametresPage';
import { PricesPage } from '../features/prices/PricesPage';
import { FamilierPage } from '../features/pets/FamilierPage';
import { HdvPage } from '../features/hdv/HdvPage';
import { ForgemagiePage } from '../features/forgemagie/ForgemagiePage';
import { preloadCraftProfits } from '../features/prices/useCraftProfits';
import { useActiveServer } from './ServerContext';
import { useForgemagiePageEnabled } from './useForgemagiePageEnabled';
import type { AccentColorId } from '../domain/accent-colors';
import { getAccentColorId, setAccentColorId } from '../persistence/accent-color-preference';
import type { PriceMode } from '../domain/price-modes';
import { getPriceMode, setPriceMode } from '../persistence/price-mode-preference';
import { recordVisit } from '../services/visit-api';
import { PlayerCounters } from '../features/dungeon-counter/DungeonCounterBubble';
import type { DesignId } from '../domain/designs';
import { applyDesign, getDesignId, setDesignId } from '../persistence/design-preference';

// specs/023-hdv-price-entry (FR-001b): the Accueil page is out of the navigation for now; its code
// (src/features/home/AccueilPage.tsx) is kept so it can come back later.
const NAV_ITEMS = [
  { to: ROUTES.search, label: 'Recherche', icon: 'search' as const, end: true },
  { to: ROUTES.pinned, label: 'Suivis', icon: 'bookmark' as const, end: false },
  { to: ROUTES.prices, label: 'Rentabilité', icon: 'trending-up' as const, end: false },
  { to: ROUTES.hdv, label: 'HDV', icon: 'store' as const, end: false },
  { to: ROUTES.pets, label: 'XP Familier', icon: 'paw' as const, end: false },
  { to: ROUTES.forgemagie, label: 'Forgemagie', icon: 'anvil' as const, end: false },
];

const SITE_NAME = 'Dofus Craft';
// The browser tab's title of each page, so tabs, history and bookmarks can be told apart.
const PAGE_TITLES: Record<string, string> = {
  [ROUTES.search]: `${SITE_NAME} — Crafter ou acheter ? Rentabilité des crafts Dofus`,
  [ROUTES.pinned]: `Suivis — ${SITE_NAME}`,
  [ROUTES.prices]: `Rentabilité des crafts — ${SITE_NAME}`,
  [ROUTES.hdv]: `Prix de l'HDV — ${SITE_NAME}`,
  [ROUTES.pets]: `XP Familier — ${SITE_NAME}`,
  [ROUTES.forgemagie]: `Forgemagie — ${SITE_NAME}`,
  [ROUTES.settings]: `Paramètres — ${SITE_NAME}`,
};

function NotFoundPage() {
  return (
    <>
      <header className="page-header">
        <h1>Page introuvable</h1>
      </header>
      <EmptyState icon="search" title="Cette adresse n'existe pas" description="Le lien est peut-être incomplet, ou la page a changé d'adresse.">
        <Link to={ROUTES.search} className="btn btn-primary">Aller à la recherche</Link>
      </EmptyState>
    </>
  );
}

// specs/050-forgemagie-page-toggle (FR-004): what the Forgemagie address shows while the page is off.
function ForgemagieUnavailablePage() {
  return (
    <>
      <header className="page-header">
        <h1>Forgemagie</h1>
      </header>
      <EmptyState icon="anvil" title="Forgemagie est momentanément indisponible" description="La page reviendra bientôt. Vos séances et vos données sont conservées.">
        <Link to={ROUTES.search} className="btn btn-primary">Aller à la recherche</Link>
      </EmptyState>
    </>
  );
}

export function AppShell() {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const stored = window.localStorage.getItem('craftcheck-theme');
    if (stored === 'light' || stored === 'dark') return stored;
    return typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark';
  });
  const [accentColor, setAccentColor] = useState<AccentColorId>(() => getAccentColorId());
  const [priceMode, setPriceModeState] = useState<PriceMode>(() => getPriceMode());
  const [design, setDesignState] = useState<DesignId>(() => getDesignId());
  // Saved only on the player's own choice, so the default can change without being frozen in.
  const chooseDesign = (designId: DesignId) => {
    setDesignState(designId);
    setDesignId(designId);
  };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('craftcheck-theme', theme);
  }, [theme]);
  useEffect(() => {
    document.documentElement.dataset.accent = accentColor;
    setAccentColorId(accentColor);
  }, [accentColor]);
  useEffect(() => {
    setPriceMode(priceMode);
  }, [priceMode]);
  useEffect(() => {
    applyDesign(design);
  }, [design]);
  useEffect(() => {
    void recordVisit();
  }, []);
  const { serverId } = useActiveServer();
  // specs/050-forgemagie-page-toggle: the owner turns the Forgemagie page on or off; off, its link is
  // gone and its address says so (FR-003, FR-004).
  const { enabled: forgemagieEnabled, reading: readingForgemagie } = useForgemagiePageEnabled();
  // specs/021-background-data-loading (FR-006, FR-009): the Prix list is prepared in the background
  // for the active server and price mode, so it's already there when the player opens the page.
  useEffect(() => preloadCraftProfits(serverId, priceMode), [serverId, priceMode]);

  // On a page change: the tab's title follows, and the focus moves to the page itself, so a keyboard
  // or screen-reader user lands on the new content rather than staying on the menu link.
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const firstPage = useRef(true);
  useEffect(() => {
    document.title = PAGE_TITLES[pathname] ?? `Page introuvable — ${SITE_NAME}`;
    if (firstPage.current) {
      firstPage.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#contenu">Aller au contenu</a>
      <nav className="app-nav" aria-label="Navigation principale">
        <div className="app-nav-brand">
          <span className="app-nav-brand-mark" aria-hidden="true">DC</span>
          <span className="app-nav-brand-name">
            Dofus<span className="app-nav-brand-accent">Craft</span>
          </span>
        </div>
        <ServerSwitcher />
        <ul className="app-nav-list">
          {NAV_ITEMS.filter((item) => forgemagieEnabled || item.to !== ROUTES.forgemagie).map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`}
              >
                <Icon name={item.icon} size={20} />
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
        {/* Paramètres is reached from this icon, not from the page list above. */}
        <div className="app-nav-footer">
          <NavLink
            to={ROUTES.settings}
            className={({ isActive }) => `icon-button app-nav-settings${isActive ? ' active' : ''}`}
            aria-label="Paramètres"
            title="Paramètres"
          >
            <Icon name="settings" size={18} />
          </NavLink>
          <button
            type="button"
            className="icon-button"
            aria-label={theme === 'dark' ? 'Activer le thème clair' : 'Activer le thème sombre'}
            onClick={() => setTheme((current) => current === 'dark' ? 'light' : 'dark')}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
          </button>
        </div>
      </nav>
      <div className="app-shell-main">
        <PinnedPriceMigrationNotice />
        <main className="app-page" id="contenu" tabIndex={-1} ref={mainRef}>
          <InfoBanner />
          <ErrorBoundary key={pathname}>
          <Routes>
            {/* Former Accueil page (specs/023 FR-001b): its address now opens the Recherche page. */}
            <Route path={ROUTES.home} element={<Navigate to={ROUTES.search} replace />} />
            <Route
              path={ROUTES.search}
              element={<RecherchePage priceMode={priceMode} />}
            />
            <Route path={ROUTES.pinned} element={<EpinglesPage priceMode={priceMode} />} />
            {/* Former address of the Suivis page, kept so existing bookmarks still land on it. */}
            <Route path={ROUTES.legacyPinned} element={<Navigate to={ROUTES.pinned} replace />} />
            <Route path={ROUTES.prices} element={<PricesPage priceMode={priceMode} />} />
            {/* Former address of the Rentabilité page (named « Prix » until 2026-09-28). */}
            <Route path={ROUTES.legacyPrices} element={<Navigate to={ROUTES.prices} replace />} />
            <Route path={ROUTES.hdv} element={<HdvPage priceMode={priceMode} />} />
            <Route path={ROUTES.pets} element={<FamilierPage priceMode={priceMode} />} />
            <Route
              path={ROUTES.forgemagie}
              element={forgemagieEnabled
                ? <ForgemagiePage priceMode={priceMode} />
                : readingForgemagie
                  ? <p className="empty" role="status">Chargement…</p>
                  : <ForgemagieUnavailablePage />}
            />
            <Route
              path={ROUTES.settings}
              element={
                <ParametresPage
                  theme={theme}
                  setTheme={setTheme}
                  accentColor={accentColor}
                  setAccentColor={setAccentColor}
                  priceMode={priceMode}
                  setPriceMode={setPriceModeState}
                  design={design}
                  setDesign={chooseDesign}
                />
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </ErrorBoundary>
        </main>
      </div>
      <PlayerCounters />
    </div>
  );
}
