import { useEffect } from 'react';
import { InfoBanner } from '../components/InfoBanner';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ROUTES } from './router';
import { firstEnabledPage } from '../domain/site-settings';
import { PriceModeBadge } from '../features/settings/PriceModeBadge';
import { PriceModeToast } from '../features/settings/PriceModeToast';
import { PinnedPriceMigrationNotice } from '../features/server/PinnedPriceMigrationNotice';
import { preloadCraftProfits } from '../features/prices/useCraftProfits';
import { useActiveServer } from './ServerContext';
import { PlayerCounters } from '../features/dungeon-counter/DungeonCounterBubble';
import { NAV_ITEMS } from './nav-items';
import { AppTopBar } from './AppTopBar';
import { AppRoutes } from './AppRoutes';
import { useShellPreferences } from './useShellPreferences';
import { useShellSiteSettings } from './useShellSiteSettings';
import { usePageChange } from './usePageChange';
import { useNavFit, useNavMarker } from './useNavLayout';

export function AppShell() {
  const { theme, setTheme, dofus, setDofus, priceMode, setPriceModeState } = useShellPreferences();
  const { serverId } = useActiveServer();
  const { siteSettings, readingSiteSettings } = useShellSiteSettings();
  // specs/071 (seven pages): every page of the navigation can be turned off. The entry points of the site
  // (home, logo, « back » links) lead to the first page still on; none left, to a message (FR-007, FR-006).
  const entryPage = firstEnabledPage(siteSettings);
  const linkName = entryPage?.route === 'search' ? 'la recherche' : entryPage?.label;
  const entry = entryPage ? { label: entryPage.label, to: ROUTES[entryPage.route], linkName: linkName ?? entryPage.label } : undefined;
  const entryTo = entry?.to ?? ROUTES.settings;
  const entryName = entryPage?.route === 'search' ? 'la recherche' : (entryPage?.label ?? 'les paramètres');
  const navItems = NAV_ITEMS.filter((item) => siteSettings[item.page]);
  // specs/021-background-data-loading (FR-006, FR-009): the Prix list is prepared in the background
  // for the active server and price mode, so it's already there when the player opens the page.
  useEffect(() => preloadCraftProfits(serverId, priceMode), [serverId, priceMode]);

  const { pathname, mainRef } = usePageChange();
  const { navListRef, navMainRef, moreRef, shownKey, isShown } = useNavFit(navItems);
  const marketItems = navItems.filter((item) => item.group === 'market');
  const toolItems = navItems.filter((item) => item.group === 'tools');
  const marketMenu = marketItems.length >= 2;
  // The pages that are neither a link on the bar nor in one of its menus.
  const plusItems = navItems.filter((item) => item.group !== 'tools' && !(marketMenu && item.group === 'market') && !isShown(item.to));
  useNavMarker(navListRef, pathname, navItems, siteSettings, shownKey);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#contenu">Aller au contenu</a>
      <AppTopBar
        entryTo={entryTo}
        entryName={entryName}
        dofus={dofus}
        navItems={navItems}
        marketItems={marketItems}
        toolItems={toolItems}
        marketMenu={marketMenu}
        plusItems={plusItems}
        isShown={isShown}
        navListRef={navListRef}
        navMainRef={navMainRef}
        moreRef={moreRef}
      />
      <PriceModeToast priceMode={priceMode} />
      <div className="app-shell-main">
        <PinnedPriceMigrationNotice />
        <main className="app-page" id="contenu" tabIndex={-1} ref={mainRef}>
          {pathname !== ROUTES.settings && <PriceModeBadge priceMode={priceMode} />}
          <InfoBanner />
          <ErrorBoundary key={pathname}>
          {/* Mounted again on each page, like the boundary: the page fades in (styles/parts). */}
          <div className="page-enter">
            <AppRoutes
              siteSettings={siteSettings}
              readingSiteSettings={readingSiteSettings}
              entry={entry}
              priceMode={priceMode}
              setPriceMode={setPriceModeState}
              theme={theme}
              setTheme={setTheme}
              dofus={dofus}
              setDofus={setDofus}
            />
          </div>
          </ErrorBoundary>
        </main>
      </div>
      <PlayerCounters />
    </div>
  );
}
