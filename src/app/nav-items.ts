import { ROUTES } from './router';
import type { SiteSettingField } from '../domain/site-settings';
import type { IconName } from '../components/Icon';
import type { NavGroup } from './nav-layout';

// specs/023-hdv-price-entry (FR-001b): the Accueil page is out of the navigation for now; its code
// (src/features/home/AccueilPage.tsx) is kept so it can come back later.
// `group`: the pages of « Marché » (HDV, Bons plans) are links while the bar has room and one menu when it has not;
// the pages of « Outils » are always in one menu. `priority`: the higher it is, the longer a free link stays on the
// bar when it is too narrow (the rest goes to « Plus »). See nav-layout.ts.
export interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  end: boolean;
  page: SiteSettingField;
  priority: number;
  group?: NavGroup;
}
export const NAV_ITEMS: NavItem[] = [
  { to: ROUTES.search, label: 'Recherche', icon: 'search', end: true, page: 'searchPage', priority: 10 },
  { to: ROUTES.pinned, label: 'Suivis', icon: 'bookmark', end: false, page: 'pinnedPage', priority: 8 },
  { to: ROUTES.prices, label: 'Rentabilité', icon: 'trending-up', end: false, page: 'pricesPage', priority: 9 },
  { to: ROUTES.hdv, label: 'HDV', icon: 'store', end: false, page: 'hdvPage', priority: 7, group: 'market' },
  { to: ROUTES.pets, label: 'XP Familier', icon: 'paw', end: false, page: 'petsPage', priority: 4, group: 'tools' },
  { to: ROUTES.forgemagie, label: 'Forgemagie', icon: 'anvil', end: false, page: 'forgemagiePage', priority: 3, group: 'tools' },
  { to: ROUTES.brisage, label: 'Brisage', icon: 'hammer', end: false, page: 'brisagePage', priority: 5, group: 'tools' },
  { to: ROUTES.bonsPlans, label: 'Bons plans', icon: 'coins', end: false, page: 'bonsPlansPage', priority: 6, group: 'market' },
];

export const SITE_NAME = 'Dofus Craft';
// The browser tab's title of each page, so tabs, history and bookmarks can be told apart.
export const PAGE_TITLES: Record<string, string> = {
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
