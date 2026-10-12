import { DEFAULT_SITE_SETTINGS, type SiteSettings } from '../../src/domain/site-settings';

// specs/050-forgemagie-page-toggle (contracts/site-settings-api.md): the public read of the site
// settings. Writes only happen in the Access-protected dofus-craft-admin Worker.

// Typed structurally so the module also compiles in the app's test setup (no Workers types there).
type ReadDb = { prepare(sql: string): { first<T>(): Promise<T | null> } };

export const FORGEMAGIE_PAGE_KEY = 'forgemagie_page';

// GET /site-settings: never an error — settings that can't be read (e.g. the table not created yet)
// are the defaults, so the site gets a plain « disabled » rather than a failed call.
export async function siteSettingsResponse(db: ReadDb): Promise<SiteSettings> {
  try {
    return await readSiteSettings(db);
  } catch {
    return DEFAULT_SITE_SETTINGS;
  }
}

// Always a complete object; a setting never saved has its default (FR-002).
export async function readSiteSettings(db: ReadDb): Promise<SiteSettings> {
  const row = await db.prepare(`SELECT value FROM site_settings WHERE key = '${FORGEMAGIE_PAGE_KEY}'`).first<{ value: string }>();
  return row ? { forgemagiePage: row.value === '1' } : DEFAULT_SITE_SETTINGS;
}
