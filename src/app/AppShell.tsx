import { Suspense, useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react';
import { InfoBanner } from '../components/InfoBanner';
import { Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ROUTES } from './router';
import { NoPageAvailable, PageUnavailable, type PageEntry } from './PageUnavailable';
import { firstEnabledPage, type SiteSettingField } from '../domain/site-settings';
import { Icon } from '../components/Icon';
import { ServerSwitcher } from '../features/server/ServerSwitcher';
import { PriceModeSwitch } from '../features/settings/PriceModeSwitch';
import { PriceModeBadge } from '../features/settings/PriceModeBadge';
import { PriceModeToast } from '../features/settings/PriceModeToast';
import { PinnedPriceMigrationNotice } from '../features/server/PinnedPriceMigrationNotice';
import { RecherchePage } from '../features/search/RecherchePage';
import { preloadCraftProfits } from '../features/prices/useCraftProfits';
import { useActiveServer } from './ServerContext';
import { useSiteSettings } from './useSiteSettings';
import type { PriceMode } from '../domain/price-modes';
import { getPriceMode, setPriceMode } from '../persistence/price-mode-preference';
import { recordVisit } from '../services/visit-api';
import { prefersReducedMotion } from '../services/motion';
import { PlayerCounters } from '../features/dungeon-counter/DungeonCounterBubble';
import { lazyPage } from './lazy-page';
import { useDofusTheme } from './useDofusTheme';
import { DEFAULT_DOFUS, dofusById } from '../domain/dofus-themes';

// Every page but Recherche (the landing route) is fetched when first visited, so the first load
// doesn't carry the code and data of every page.
const EpinglesPage = lazyPage(() => import('../features/catalogue/EpinglesPage').then((m) => ({ default: m.EpinglesPage })));
const ParametresPage = lazyPage(() => import('../features/settings/ParametresPage').then((m) => ({ default: m.ParametresPage })));
const PricesPage = lazyPage(() => import('../features/prices/PricesPage').then((m) => ({ default: m.PricesPage })));
const FamilierPage = lazyPage(() => import('../features/pets/FamilierPage').then((m) => ({ default: m.FamilierPage })));
const HdvPage = lazyPage(() => import('../features/hdv/HdvPage').then((m) => ({ default: m.HdvPage })));
const ForgemagiePage = lazyPage(() => import('../features/forgemagie/ForgemagiePage').then((m) => ({ default: m.ForgemagiePage })));
const BrisagePage = lazyPage(() => import('../features/brisage/BrisagePage').then((m) => ({ default: m.BrisagePage })));

// specs/023-hdv-price-entry (FR-001b): the Accueil page is out of the navigation for now; its code
// (src/features/home/AccueilPage.tsx) is kept so it can come back later.
const NAV_ITEMS = [
  { to: ROUTES.search, label: 'Recherche', icon: 'search' as const, end: true, page: 'searchPage' as const },
  { to: ROUTES.pinned, label: 'Suivis', icon: 'bookmark' as const, end: false, page: 'pinnedPage' as const },
  { to: ROUTES.prices, label: 'Rentabilité', icon: 'trending-up' as const, end: false, page: 'pricesPage' as const },
  { to: ROUTES.hdv, label: 'HDV', icon: 'store' as const, end: false, page: 'hdvPage' as const },
  { to: ROUTES.pets, label: 'XP Familier', icon: 'paw' as const, end: false, page: 'petsPage' as const },
  { to: ROUTES.forgemagie, label: 'Forgemagie', icon: 'anvil' as const, end: false, page: 'forgemagiePage' as const },
  { to: ROUTES.brisage, label: 'Brisage', icon: 'hammer' as const, end: false, page: 'brisagePage' as const },
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

function NotFoundPage({ entry }: { entry: PageEntry | undefined }) {
  if (!entry) return <NoPageAvailable />;
  return (
    <>
      <header className="page-header">
        <h1>Page introuvable</h1>
      </header>
      <EmptyState icon="search" title="Cette adresse n'existe pas" description="Le lien est peut-être incomplet, ou la page a changé d'adresse.">
        <Link to={entry.to} className="btn btn-primary">Aller à {entry.linkName}</Link>
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
  const [dofus, setDofus] = useDofusTheme();
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
  const hdvEnabled = siteSettings.hdvPage;
  // specs/071 (seven pages): every page of the navigation can be turned off. The entry points of the site
  // (home, logo, « back » links) lead to the first page still on; none left, to a message (FR-007, FR-006).
  const entryPage = firstEnabledPage(siteSettings);
  const linkName = entryPage?.route === 'search' ? 'la recherche' : entryPage?.label;
  const entry = entryPage ? { label: entryPage.label, to: ROUTES[entryPage.route], linkName: linkName ?? entryPage.label } : undefined;
  const entryTo = entry?.to ?? ROUTES.settings;
  const entryName = entryPage?.route === 'search' ? 'la recherche' : (entryPage?.label ?? 'les paramètres');
  const navItems = NAV_ITEMS.filter((item) => siteSettings[item.page]);
  // A page's address: the page when it is on, « Chargement… » while the settings are first read (so an enabled page
  // is never said unavailable), the unavailable page when it is off.
  const guarded = (field: SiteSettingField, element: ReactElement) => {
    if (siteSettings[field]) return element;
    if (readingSiteSettings) return <p className="empty" role="status">Chargement…</p>;
    const item = NAV_ITEMS.find((candidate) => candidate.page === field)!;
    return <PageUnavailable label={item.label} icon={item.icon} entry={entry} />;
  };
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
  }, [pathname, navItems.length, siteSettings]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#contenu">Aller au contenu</a>
      <nav className="app-nav" aria-label="Navigation principale">
        <Link className="app-nav-brand" to={entryTo} aria-label={`DofusCraft, aller à ${entryName}`}>
          <img
            className="app-nav-brand-mark"
            src={dofusById(dofus).image}
            alt=""
            width="44"
            height="44"
            onError={(event) => {
              const fallback = dofusById(DEFAULT_DOFUS).image;
              if (!event.currentTarget.src.endsWith(fallback)) event.currentTarget.src = fallback;
            }}
          />
          <span className="app-nav-brand-name">
            Dofus<span className="app-nav-brand-accent">Craft</span>
          </span>
        </Link>
        <ul className="app-nav-list" ref={navListRef}>
          {navItems.map((item) => (
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
          <PriceModeSwitch priceMode={priceMode} setPriceMode={setPriceModeState} />
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
      <PriceModeToast priceMode={priceMode} />
      <div className="app-shell-main">
        <PinnedPriceMigrationNotice />
        <main className="app-page" id="contenu" tabIndex={-1} ref={mainRef}>
          {pathname !== ROUTES.settings && <PriceModeBadge priceMode={priceMode} />}
          <InfoBanner />
          <ErrorBoundary key={pathname}>
          {/* Mounted again on each page, like the boundary: the page fades in (global.css). */}
          <div className="page-enter">
          <Suspense fallback={<p className="empty" role="status">Chargement…</p>}>
          <Routes>
            {/* Former Accueil page (specs/023 FR-001b): its address now opens the Recherche page. */}
            <Route
              path={ROUTES.home}
              element={readingSiteSettings
                ? <p className="empty" role="status">Chargement…</p>
                : entry ? <Navigate to={entry.to} replace /> : <NoPageAvailable />}
            />
            <Route path={ROUTES.search} element={guarded('searchPage', <RecherchePage priceMode={priceMode} />)} />
            <Route path={ROUTES.pinned} element={guarded('pinnedPage', <EpinglesPage priceMode={priceMode} />)} />
            {/* Former address of the Suivis page, kept so existing bookmarks still land on it. */}
            <Route path={ROUTES.legacyPinned} element={<Navigate to={ROUTES.pinned} replace />} />
            <Route path={ROUTES.prices} element={guarded('pricesPage', <PricesPage priceMode={priceMode} />)} />
            {/* Former address of the Rentabilité page (named « Prix » until 2026-09-28). */}
            <Route path={ROUTES.legacyPrices} element={<Navigate to={ROUTES.prices} replace />} />
            <Route path={ROUTES.hdv} element={guarded('hdvPage', <HdvPage priceMode={priceMode} />)} />
            {/* specs/060-page-brisage (FR-001): reachable from the Brisage link of the menu. */}
            <Route path={ROUTES.brisage} element={guarded('brisagePage', <BrisagePage priceMode={priceMode} />)} />
            <Route path={ROUTES.pets} element={guarded('petsPage', <FamilierPage priceMode={priceMode} hdvPageEnabled={hdvEnabled} />)} />
            <Route path={ROUTES.forgemagie} element={guarded('forgemagiePage', <ForgemagiePage priceMode={priceMode} />)} />
            <Route
              path={ROUTES.settings}
              element={
                <ParametresPage
                  theme={theme}
                  setTheme={setTheme}
                  dofus={dofus}
                  setDofus={setDofus}
                  priceMode={priceMode}
                  setPriceMode={setPriceModeState}
                />
              }
            />
            <Route path="*" element={<NotFoundPage entry={entry} />} />
          </Routes>
          </Suspense>
          </div>
          </ErrorBoundary>
        </main>
      </div>
      <PlayerCounters />
    </div>
  );
}
