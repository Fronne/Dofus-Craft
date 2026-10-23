import { DEFAULT_SITE_SETTINGS, SITE_SETTING_ENTRIES, type SiteSettings, type SiteSettingField } from '../../src/domain/site-settings';

// specs/050-forgemagie-page-toggle, specs/053-hdv-page-toggle (contracts/site-settings-api.md): the
// public read of the site settings. Writes only happen in the Access-protected dofus-craft-admin Worker.

// Typed structurally so the module also compiles in the app's test setup (no Workers types there).
type ReadDb = { prepare(sql: string): { all<T>(): Promise<{ results: T[] }> } };

// The D1 key of each setting (specs/071: the seven pages of SITE_PAGES; specs/072: the ranking setting).
export const SITE_SETTING_KEYS = Object.fromEntries(SITE_SETTING_ENTRIES.map((entry) => [entry.field, entry.key])) as Record<SiteSettingField, string>;

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
  const keys = SITE_SETTING_ENTRIES.map((entry) => `'${entry.key}'`).join(', ');
  const { results } = await db.prepare(`SELECT key, value FROM site_settings WHERE key IN (${keys})`).all<{ key: string; value: string }>();
  const saved = new Map(results.map((row) => [row.key, row.value === '1']));
  const settings = { ...DEFAULT_SITE_SETTINGS };
  for (const entry of SITE_SETTING_ENTRIES) settings[entry.field] = saved.get(entry.key) ?? entry.enabledByDefault;
  return settings;
}
