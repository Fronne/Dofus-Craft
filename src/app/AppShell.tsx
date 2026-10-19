import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import { BrisagePage } from '../features/brisage/BrisagePage';
import { preloadCraftProfits } from '../features/prices/useCraftProfits';
import { useActiveServer } from './ServerContext';
import { useSiteSettings } from './useSiteSettings';
import type { PriceMode } from '../domain/price-modes';
import { getPriceMode, setPriceMode } from '../persistence/price-mode-preference';
import { recordVisit } from '../services/visit-api';
import { prefersReducedMotion } from '../services/motion';
import { PlayerCounters } from '../features/dungeon-counter/DungeonCounterBubble';

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
  [ROUTES.brisage]: `Brisage — ${SITE_NAME}`,
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

// specs/053-hdv-page-toggle (FR-004): what the HDV address shows while the page is off.
function HdvUnavailablePage() {
  return (
    <>
      <header className="page-header">
        <h1>HDV</h1>
      </header>
      <EmptyState icon="store" title="HDV est momentanément indisponible" description="La page reviendra bientôt. Vos prix sont conservés.">
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
  const [priceMode, setPriceModeState] = useState<PriceMode>(() => getPriceMode());

  useEffect(() => {
    const root = document.documentElement;
    // A theme chosen by the player (not the one the page opens with) fades in: every color glides
    // for a moment (global.css).
    const switching = root.dataset.theme !== undefined && root.dataset.theme !== theme;
    root.dataset.theme = theme;
    window.localStorage.setItem('craftcheck-theme', theme);
    if (!switching || prefersReducedMotion()) return;
    root.dataset.themeSwitching = '';
    const done = window.setTimeout(() => delete root.dataset.themeSwitching, 400);
    return () => window.clearTimeout(done);
  }, [theme]);
  useEffect(() => {
    setPriceMode(priceMode);
  }, [priceMode]);
  // The side illustrations drift up slowly while the page scrolls, for a sense of depth: a
  // twentieth of the scroll, 48px at most (global.css reads --side-art-shift).
  useEffect(() => {
    if (typeof window.matchMedia !== 'function' || prefersReducedMotion()) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        document.documentElement.style.setProperty('--side-art-shift', `${Math.min(window.scrollY / 20, 48)}px`);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);
  useEffect(() => {
    void recordVisit();
  }, []);
  const { serverId } = useActiveServer();
  // specs/050-forgemagie-page-toggle, specs/053-hdv-page-toggle: the owner turns the Forgemagie and
  // HDV pages on or off; off, a page's link is gone and its address says so (FR-003, FR-004).
  const { settings: siteSettings, reading: readingSiteSettings } = useSiteSettings();
  const forgemagieEnabled = siteSettings.forgemagiePage;
  const hdvEnabled = siteSettings.hdvPage;
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

  // The diamond under the current page's link slides from one link to the next: its place is the
  // middle of the active link's bottom edge, handed to the list as CSS variables (global.css). No
  // active link (Paramètres), no diamond.
  const navListRef = useRef<HTMLUListElement>(null);
  useLayoutEffect(() => {
    const list = navListRef.current;
    if (!list) return;
    const place = () => {
      const item = list.querySelector<HTMLElement>('.app-nav-link.active')?.parentElement;
      list.style.setProperty('--nav-marker-on', item ? '1' : '0');
      if (!item) return;
      list.style.setProperty('--nav-marker-x', `${item.offsetLeft + item.offsetWidth / 2}px`);
      // Its own line when the links wrap on two.
      list.style.setProperty('--nav-marker-y', `${item.offsetTop + item.offsetHeight}px`);
    };
    place();
    // It slides only once it has been placed a first time: it must not glide in when the page opens.
    const ready = requestAnimationFrame(() => { list.dataset.markerReady = ''; });
    // The links move when the web font arrives or when the list of pages changes.
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : undefined;
    observer?.observe(list);
    return () => {
      cancelAnimationFrame(ready);
      observer?.disconnect();
    };
  }, [pathname, forgemagieEnabled, hdvEnabled]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#contenu">Aller au contenu</a>
      <nav className="app-nav" aria-label="Navigation principale">
        <Link className="app-nav-brand" to={ROUTES.search} aria-label="DofusCraft, aller à la recherche">
          <img className="app-nav-brand-mark" src="/dofus-emeraude.png" alt="" width="44" height="44" />
          <span className="app-nav-brand-name">
            Dofus<span className="app-nav-brand-accent">Craft</span>
          </span>
        </Link>
        <ul className="app-nav-list" ref={navListRef}>
          {NAV_ITEMS.filter((item) => (forgemagieEnabled || item.to !== ROUTES.forgemagie) && (hdvEnabled || item.to !== ROUTES.hdv)).map((item) => (
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
        {/* specs/051-site-visual-refresh: the right end of the top bar — active server, then
            Paramètres (reached from this icon, not from the page list) and the theme toggle. */}
        <div className="app-nav-footer">
          <ServerSwitcher />
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
          {/* Mounted again on each page, like the boundary: the page fades in (global.css). */}
          <div className="page-enter">
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
            <Route
              path={ROUTES.hdv}
              element={hdvEnabled
                ? <HdvPage priceMode={priceMode} />
                : readingSiteSettings
                  ? <p className="empty" role="status">Chargement…</p>
                  : <HdvUnavailablePage />}
            />
            {/* specs/060-page-brisage (FR-001): reachable by its address only, no menu entry for now. */}
            <Route path={ROUTES.brisage} element={<BrisagePage priceMode={priceMode} />} />
            <Route path={ROUTES.pets} element={<FamilierPage priceMode={priceMode} hdvPageEnabled={hdvEnabled} />} />
            <Route
              path={ROUTES.forgemagie}
              element={forgemagieEnabled
                ? <ForgemagiePage priceMode={priceMode} />
                : readingSiteSettings
                  ? <p className="empty" role="status">Chargement…</p>
                  : <ForgemagieUnavailablePage />}
            />
            <Route
              path={ROUTES.settings}
              element={
                <ParametresPage
                  theme={theme}
                  setTheme={setTheme}
                  priceMode={priceMode}
                  setPriceMode={setPriceModeState}
                />
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </div>
          </ErrorBoundary>
        </main>
      </div>
      <PlayerCounters />
    </div>
  );
}
