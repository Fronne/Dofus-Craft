import { DEFAULT_SITE_SETTINGS, type SiteSettings } from '../../src/domain/site-settings';

// specs/050-forgemagie-page-toggle, specs/053-hdv-page-toggle (contracts/site-settings-api.md): the
// public read of the site settings. Writes only happen in the Access-protected dofus-craft-admin Worker.

// Typed structurally so the module also compiles in the app's test setup (no Workers types there).
type ReadDb = { prepare(sql: string): { all<T>(): Promise<{ results: T[] }> } };

export const FORGEMAGIE_PAGE_KEY = 'forgemagie_page';
export const HDV_PAGE_KEY = 'hdv_page';

// The D1 key of each setting.
export const SITE_SETTING_KEYS: Record<keyof SiteSettings, string> = {
  forgemagiePage: FORGEMAGIE_PAGE_KEY,
  hdvPage: HDV_PAGE_KEY,
};

// GET /site-settings: never an error — settings that can't be read (e.g. the table not created yet)
// are the defaults, so the site gets plain defaults rather than a failed call.
export async function siteSettingsResponse(db: ReadDb): Promise<SiteSettings> {
  try {
    return await readSiteSettings(db);
  } catch {
    return DEFAULT_SITE_SETTINGS;
  }
}

// Always a complete object; a setting never saved has its default (FR-002).
export async function readSiteSettings(db: ReadDb): Promise<SiteSettings> {
  const { results } = await db
    .prepare(`SELECT key, value FROM site_settings WHERE key IN ('${FORGEMAGIE_PAGE_KEY}', '${HDV_PAGE_KEY}')`)
    .all<{ key: string; value: string }>();
  const saved = new Map(results.map((row) => [row.key, row.value === '1']));
  return {
    forgemagiePage: saved.get(FORGEMAGIE_PAGE_KEY) ?? DEFAULT_SITE_SETTINGS.forgemagiePage,
    hdvPage: saved.get(HDV_PAGE_KEY) ?? DEFAULT_SITE_SETTINGS.hdvPage,
  };
}
