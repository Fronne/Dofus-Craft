import { Suspense, type ReactElement } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { ROUTES } from './router';
import { NoPageAvailable, PageUnavailable, type PageEntry } from './PageUnavailable';
import type { SiteSettingField, SiteSettings } from '../domain/site-settings';
import { RecherchePage } from '../features/search/RecherchePage';
import type { PriceMode } from '../domain/price-modes';
import { lazyPage } from './lazy-page';
import { dofusById, type DofusId } from '../domain/dofus-themes';
import { PageLoader } from '../components/PageLoader';
import { NAV_ITEMS } from './nav-items';

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

interface AppRoutesProps {
  siteSettings: SiteSettings;
  readingSiteSettings: boolean;
  entry: PageEntry | undefined;
  priceMode: PriceMode;
  setPriceMode: (priceMode: PriceMode) => void;
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  dofus: DofusId;
  setDofus: (dofus: DofusId) => void;
}

// The pages and the addresses of the site, in the loader shown while a page is fetched.
export function AppRoutes({
  siteSettings, readingSiteSettings, entry, priceMode, setPriceMode, theme, setTheme, dofus, setDofus,
}: AppRoutesProps) {
  const hdvEnabled = siteSettings.hdvPage;
  // A page's address: the page when it is on, « Chargement… » while the settings are first read (so an enabled page
  // is never said unavailable), the unavailable page when it is off.
  const guarded = (field: SiteSettingField, element: ReactElement) => {
    if (siteSettings[field]) return element;
    if (readingSiteSettings) return <PageLoader image={dofusById(dofus).image} />;
    const item = NAV_ITEMS.find((candidate) => candidate.page === field)!;
    return <PageUnavailable label={item.label} icon={item.icon} entry={entry} />;
  };

  return (
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
              setPriceMode={setPriceMode}
            />
          }
        />
        {/* specs/075-connexion-discord-site: the profile, reached from the account menu (not a page of the navigation). */}
        <Route path={ROUTES.profile} element={<ProfilPage />} />
        <Route path="*" element={<NotFoundPage entry={entry} />} />
      </Routes>
    </Suspense>
  );
}
