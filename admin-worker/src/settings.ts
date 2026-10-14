import type { SiteSettings, SiteSettingsChange } from '../../src/domain/site-settings';
import { readSiteSettings, SITE_SETTING_KEYS } from '../../worker/src/site-settings';

// specs/050-forgemagie-page-toggle: writes on the site_settings table, reachable only through the
// Access-protected API (src/index.ts). Input is validated before it gets here.
type Statement = {
  bind(...values: unknown[]): Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
};
export type SettingsDb = { prepare(sql: string): Statement; batch(statements: Statement[]): Promise<unknown> };

export function getSettings(db: SettingsDb): Promise<SiteSettings> {
  return readSiteSettings(db);
}

// specs/053-hdv-page-toggle: only the settings in `change` are written, so changing one page never
// rewrites the other (FR-010); several are written together or not at all. Answers with what is
// saved, read back, so the page never shows a state it only assumed (FR-008).
export async function saveSettings(db: SettingsDb, change: SiteSettingsChange, now: Date = new Date()): Promise<SiteSettings> {
  const statements = (Object.keys(SITE_SETTING_KEYS) as (keyof SiteSettings)[])
    .filter((field) => change[field] !== undefined)
    .map((field) => db.prepare(
      `INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    ).bind(SITE_SETTING_KEYS[field], change[field] ? '1' : '0', now.toISOString()));
  if (statements.length > 0) await db.batch(statements);
  return readSiteSettings(db);
}
