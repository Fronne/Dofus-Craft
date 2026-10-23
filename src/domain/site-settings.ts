// specs/050-forgemagie-page-toggle, specs/053-hdv-page-toggle, specs/071-admin-dashboard-moderne (data-model.md): the
// owner's site settings, shared by the public site, the administration page and both Workers. One list describes the
// pages the owner can turn on or off; everything else (types, defaults, validation, storage keys, the navigation)
// derives from it. A setting never saved has its default.
export const SITE_PAGES = [
  { field: 'searchPage', key: 'search_page', label: 'Recherche', route: 'search', enabledByDefault: true },
  { field: 'pinnedPage', key: 'pinned_page', label: 'Suivis', route: 'pinned', enabledByDefault: true },
  { field: 'pricesPage', key: 'prices_page', label: 'Rentabilité', route: 'prices', enabledByDefault: true },
  { field: 'hdvPage', key: 'hdv_page', label: 'HDV', route: 'hdv', enabledByDefault: true },
  { field: 'petsPage', key: 'pets_page', label: 'XP Familier', route: 'pets', enabledByDefault: true },
  { field: 'forgemagiePage', key: 'forgemagie_page', label: 'Forgemagie', route: 'forgemagie', enabledByDefault: false },
  { field: 'brisagePage', key: 'brisage_page', label: 'Brisage', route: 'brisage', enabledByDefault: true },
] as const;

// specs/072-classement-brisage: a setting that is not a page of the navigation. Stored and edited like the pages, but
// it has no route and does not count as a page.
export const SITE_FEATURES = [
  { field: 'brisageRanking', key: 'brisage_ranking', label: 'Classement Brisage', enabledByDefault: false },
] as const;

export type SitePage = (typeof SITE_PAGES)[number];
export type SitePageField = SitePage['field'];
export type SiteFeature = (typeof SITE_FEATURES)[number];
export type SiteSettingField = SitePageField | SiteFeature['field'];
// The key of the page in the site's ROUTES (src/app/router.tsx), which this module does not import: the Workers share it.
export type SiteRouteKey = SitePage['route'];

export type SiteSettings = Record<SiteSettingField, boolean>;

// Every stored setting: the pages, then the other settings.
export const SITE_SETTING_ENTRIES: readonly { field: SiteSettingField; key: string; enabledByDefault: boolean }[] = [...SITE_PAGES, ...SITE_FEATURES];

export const DEFAULT_SITE_SETTINGS = Object.fromEntries(SITE_SETTING_ENTRIES.map((entry) => [entry.field, entry.enabledByDefault])) as SiteSettings;

// What the administration sends: only the settings it changes, so one never overwrites another.
export type SiteSettingsChange = Partial<SiteSettings>;

export type SiteSettingsValidation =
  | { ok: true; value: SiteSettingsChange }
  | { ok: false; field: SiteSettingField; error: string };

const INVALID_VALUE = 'Valeur attendue : activée ou désactivée.';

// Settings read from the service or kept on this device. The Forgemagie setting is the one every version has
// saved, so it is required; a setting a shorter answer lacks (saved before specs/053 or specs/071) gets its default,
// so a page never disappears for someone whose settings were kept before it could be turned off.
export function parseSiteSettings(value: unknown): SiteSettings | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.forgemagiePage !== 'boolean') return undefined;
  const settings = { ...DEFAULT_SITE_SETTINGS };
  for (const { field } of SITE_SETTING_ENTRIES) {
    if (record[field] === undefined) continue;
    if (typeof record[field] !== 'boolean') return undefined;
    settings[field] = record[field];
  }
  return settings;
}

export function validateSiteSettingsChange(input: unknown): SiteSettingsValidation {
  if (typeof input !== 'object' || input === null) return { ok: false, field: 'forgemagiePage', error: INVALID_VALUE };
  const record = input as Record<string, unknown>;
  const change: SiteSettingsChange = {};
  for (const { field } of SITE_SETTING_ENTRIES) {
    if (record[field] === undefined) continue;
    if (typeof record[field] !== 'boolean') return { ok: false, field, error: INVALID_VALUE };
    change[field] = record[field];
  }
  if (Object.keys(change).length === 0) return { ok: false, field: 'forgemagiePage', error: INVALID_VALUE };
  return { ok: true, value: change };
}

// Only the pages count: the other settings (specs/072) are not pages of the navigation.
export const enabledPageCount = (settings: SiteSettings): number => SITE_PAGES.filter((page) => settings[page.field]).length;

// The first page of the navigation that is on: where the site's entry points (home, logo, « back » links) lead.
export const firstEnabledPage = (settings: SiteSettings): SitePage | undefined => SITE_PAGES.find((page) => settings[page.field]);

// True when `field` is on and is the only page left on: turning it off would leave the site without a page.
export const isLastEnabledPage = (settings: SiteSettings, field: SiteSettingField): boolean =>
  SITE_PAGES.some((page) => page.field === field) && settings[field] && enabledPageCount(settings) === 1;
