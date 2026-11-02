import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { InfoBanner } from '../components/InfoBanner';
import { Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ROUTES } from './router';
import { NoPageAvailable, PageUnavailable, type PageEntry } from './PageUnavailable';
import { firstEnabledPage, type SiteSettingField } from '../domain/site-settings';
import { Icon, type IconName } from '../components/Icon';
import { NavMenu } from './NavMenu';
import { AccountMenu } from './AccountMenu';
import { groupKey, layoutNav, type NavGroup } from './nav-layout';
import { ServerSwitcher } from '../features/server/ServerSwitcher';
import { PriceModeBadge } from '../features/settings/PriceModeBadge';
import { PriceModeToast } from '../features/settings/PriceModeToast';
import { PinnedPriceMigrationNotice } from '../features/server/PinnedPriceMigrationNotice';
import { RecherchePage } from '../features/search/RecherchePage';
import { preloadCraftProfits } from '../features/prices/useCraftProfits';
import { useActiveServer } from './ServerContext';
import { useSiteSettings } from './useSiteSettings';
import { applyBonsPlansAccessFromSearch, withoutBonsPlansParameter } from '../persistence/bons-plans-access';
import type { PriceMode } from '../domain/price-modes';
import { getPriceMode, setPriceMode } from '../persistence/price-mode-preference';
import { recordVisit } from '../services/visit-api';
import { prefersReducedMotion } from '../services/motion';
import { PlayerCounters } from '../features/dungeon-counter/DungeonCounterBubble';
import { lazyPage } from './lazy-page';
import { useDofusTheme } from './useDofusTheme';
import { DEFAULT_DOFUS, dofusById } from '../domain/dofus-themes';
import { PageLoader } from '../components/PageLoader';

// Every page but Recherche (the landing route) is fetched when first visited, so the first load
// doesn't carry the code and data of every page.
const EpinglesPage = lazyPage(() => import('../features/catalogue/EpinglesPage').then((m) => ({ default: m.EpinglesPage })));
const ParametresPage = lazyPage(() => import('../features/settings/ParametresPage').then((m) => ({ default: m.ParametresPage })));
const PricesPage = lazyPage(() => import('../features/prices/PricesPage').then((m) => ({ default: m.PricesPage })));
const FamilierPage = lazyPage(() => import('../features/pets/FamilierPage').then((m) => ({ default: m.FamilierPage })));
const HdvPage = lazyPage(() => import('../features/hdv/HdvPage').then((m) => ({ default: m.HdvPage })));
const ForgemagiePage = lazyPage(() => import('../features/forgemagie/ForgemagiePage').then((m) => ({ default: m.ForgemagiePage })));
const BrisagePage = lazyPage(() => import('../features/brisage/BrisagePage').then((m) => ({ default: m.BrisagePage })));
const ProfilPage = lazyPage(() => import('../features/account/ProfilPage').then((m) => ({ default: m.ProfilPage })));
const BonsPlansPage = lazyPage(() => import('../features/good-deals/BonsPlansPage').then((m) => ({ default: m.BonsPlansPage })));

// specs/023-hdv-price-entry (FR-001b): the Accueil page is out of the navigation for now; its code
// (src/features/home/AccueilPage.tsx) is kept so it can come back later.
// `group`: the pages of « Marché » (HDV, Bons plans) are links while the bar has room and one menu when it has not;
// the pages of « Outils » are always in one menu. `priority`: the higher it is, the longer a free link stays on the
// bar when it is too narrow (the rest goes to « Plus »). See nav-layout.ts.
interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  end: boolean;
  page: SiteSettingField;
  priority: number;
  group?: NavGroup;
}
const NAV_ITEMS: NavItem[] = [
  { to: ROUTES.search, label: 'Recherche', icon: 'search', end: true, page: 'searchPage', priority: 10 },
  { to: ROUTES.pinned, label: 'Suivis', icon: 'bookmark', end: false, page: 'pinnedPage', priority: 8 },
  { to: ROUTES.prices, label: 'Rentabilité', icon: 'trending-up', end: false, page: 'pricesPage', priority: 9 },
  { to: ROUTES.hdv, label: 'HDV', icon: 'store', end: false, page: 'hdvPage', priority: 7, group: 'market' },
  { to: ROUTES.pets, label: 'XP Familier', icon: 'paw', end: false, page: 'petsPage', priority: 4, group: 'tools' },
  { to: ROUTES.forgemagie, label: 'Forgemagie', icon: 'anvil', end: false, page: 'forgemagiePage', priority: 3, group: 'tools' },
  { to: ROUTES.brisage, label: 'Brisage', icon: 'hammer', end: false, page: 'brisagePage', priority: 5, group: 'tools' },
  { to: ROUTES.bonsPlans, label: 'Bons plans', icon: 'coins', end: false, page: 'bonsPlansPage', priority: 6, group: 'market' },
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
  [ROUTES.bonsPlans]: `Bons plans de l'HDV — ${SITE_NAME}`,
  [ROUTES.settings]: `Paramètres — ${SITE_NAME}`,
  [ROUTES.profile]: `Profil — ${SITE_NAME}`,
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
  useEffect(() => {
    void recordVisit();
  }, []);
  const { serverId } = useActiveServer();
  // specs/050-forgemagie-page-toggle, specs/053-hdv-page-toggle: the owner turns the Forgemagie and
  // HDV pages on or off; off, a page's link is gone and its address says so (FR-003, FR-004).
  const { settings: sharedSettings, reading: readingSiteSettings } = useSiteSettings();
  // specs/081-bons-plans-aide-acces (US2): a browser the owner opened with `?bonsplans=1` keeps that page, whatever the
  // shared setting says. Read here because the navigation shows its link on every page.
  const [bonsPlansAccess] = useState(() => {
    const { access, touched } = applyBonsPlansAccessFromSearch(window.location.search);
    if (touched) window.history.replaceState(window.history.state, '', withoutBonsPlansParameter(window.location));
    return access;
  });
  const siteSettings = useMemo(() => (bonsPlansAccess ? { ...sharedSettings, bonsPlansPage: true } : sharedSettings), [bonsPlansAccess, sharedSettings]);
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
    if (readingSiteSettings) return <PageLoader image={dofusById(dofus).image} />;
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
  const navMainRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  // The top bar stays on one line, so a new page never pushes the server, mode, settings and theme controls onto a
  // second one: what does not fit goes into a menu (nav-layout.ts says which). Every entry is always rendered, the
  // ones left out only invisible, so their natural widths can be measured. null: not measured yet (all rendered).
  const [shownKey, setShownKey] = useState<string | null>(null);
  const navKey = navItems.map((item) => item.to).join();
  useLayoutEffect(() => {
    const main = navMainRef.current;
    const list = navListRef.current;
    if (!main || !list) return;
    const fit = () => {
      const widths: Record<string, number> = {};
      Array.from(list.children).forEach((entry) => {
        const key = (entry as HTMLElement).dataset.key;
        if (key) widths[key] = (entry as HTMLElement).offsetWidth;
      });
      const shown = layoutNav({
        items: navItems,
        widths,
        room: main.clientWidth,
        gap: parseFloat(getComputedStyle(list).columnGap) || 0,
        moreWidth: moreRef.current?.offsetWidth || 96,
        // The phone layout is a bottom tab bar that shares its width between the links: no menu there.
        compact: typeof window.matchMedia === 'function' && !window.matchMedia('(min-width: 961px)').matches,
      });
      setShownKey([...shown].sort().join('|'));
    };
    fit();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : undefined;
    observer?.observe(main);
    Array.from(list.children).forEach((entry) => observer?.observe(entry));
    return () => observer?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navKey]);
  const shown = useMemo(() => (shownKey === null ? null : new Set(shownKey.split('|'))), [shownKey]);
  const isShown = (key: string) => shown === null || shown.has(key);
  const marketItems = navItems.filter((item) => item.group === 'market');
  const toolItems = navItems.filter((item) => item.group === 'tools');
  const marketMenu = marketItems.length >= 2;
  // The pages that are neither a link on the bar nor in one of its menus.
  const plusItems = navItems.filter((item) => item.group !== 'tools' && !(marketMenu && item.group === 'market') && !isShown(item.to));
  useLayoutEffect(() => {
    const list = navListRef.current;
    if (!list) return;
    const place = () => {
      // The first active link of the entries in sight: a menu's button when the page is inside the menu.
      const shown = list.querySelector<HTMLElement>('li:not(.is-overflow) .app-nav-link.active')?.closest('li');
      list.style.setProperty('--nav-marker-on', shown ? '1' : '0');
      if (!shown) return;
      list.style.setProperty('--nav-marker-x', `${shown.offsetLeft + shown.offsetWidth / 2}px`);
      // Its own line when the links wrap on two.
      list.style.setProperty('--nav-marker-y', `${shown.offsetTop + shown.offsetHeight}px`);
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
  }, [pathname, navItems.length, siteSettings, shownKey]);

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
        <div className="app-nav-main" ref={navMainRef}>
          <ul className="app-nav-list" ref={navListRef}>
            {navItems.map((item) => (
              <li key={item.to} data-key={item.to} className={isShown(item.to) ? undefined : 'is-overflow'} aria-hidden={isShown(item.to) ? undefined : true}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  tabIndex={isShown(item.to) ? undefined : -1}
                  className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`}
                >
                  <Icon name={item.icon} size={20} />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
            {marketMenu && (
              <li data-key={groupKey('market')} className={isShown(groupKey('market')) ? undefined : 'is-overflow'} aria-hidden={isShown(groupKey('market')) ? undefined : true}>
                <NavMenu label="Marché" items={marketItems} hidden={!isShown(groupKey('market'))} />
              </li>
            )}
            {toolItems.length > 0 && (
              <li data-key={groupKey('tools')} className={isShown(groupKey('tools')) ? undefined : 'is-overflow'} aria-hidden={isShown(groupKey('tools')) ? undefined : true}>
                <NavMenu label="Outils" items={toolItems} hidden={!isShown(groupKey('tools'))} />
              </li>
            )}
          </ul>
          {plusItems.length > 0 && (
            <div className="app-nav-more" ref={moreRef}>
              <NavMenu label="Plus" items={plusItems} />
            </div>
          )}
        </div>
        {/* specs/051-site-visual-refresh: the right end of the top bar — active server, then
            the account, then Paramètres (reached from this icon, not from the page list). The theme and the price
            mode are chosen in Paramètres only: their switches left the bar to give the pages more room. */}
        <div className="app-nav-footer">
          <ServerSwitcher />
          <AccountMenu />
          <NavLink
            to={ROUTES.settings}
            className={({ isActive }) => `icon-button app-nav-settings${isActive ? ' active' : ''}`}
            aria-label="Paramètres"
            title="Paramètres"
          >
            <Icon name="settings" size={18} />
          </NavLink>
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
          <Suspense fallback={<PageLoader image={dofusById(dofus).image} />}>
          <Routes>
            {/* Former Accueil page (specs/023 FR-001b): its address now opens the Recherche page. */}
            <Route
              path={ROUTES.home}
              element={readingSiteSettings
                ? <PageLoader image={dofusById(dofus).image} />
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
            <Route path={ROUTES.bonsPlans} element={guarded('bonsPlansPage', <BonsPlansPage />)} />
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
            {/* specs/075-connexion-discord-site: the profile, reached from the account menu (not a page of the navigation). */}
            <Route path={ROUTES.profile} element={<ProfilPage />} />
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
