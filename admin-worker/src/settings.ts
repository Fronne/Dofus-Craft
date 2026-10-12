import type { SiteSettings } from '../../src/domain/site-settings';
import { FORGEMAGIE_PAGE_KEY, readSiteSettings } from '../../worker/src/site-settings';

// specs/050-forgemagie-page-toggle: writes on the site_settings table, reachable only through the
// Access-protected API (src/index.ts). Input is validated before it gets here.
type Statement = {
  bind(...values: unknown[]): Statement;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
};
export type SettingsDb = { prepare(sql: string): Statement };

export function getSettings(db: SettingsDb): Promise<SiteSettings> {
  return readSiteSettings(db);
}

// Answers with what is saved, read back, so the page never shows a state it only assumed (FR-008).
export async function saveSettings(db: SettingsDb, value: SiteSettings, now: Date = new Date()): Promise<SiteSettings> {
  await db.prepare(
    `INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  ).bind(FORGEMAGIE_PAGE_KEY, value.forgemagiePage ? '1' : '0', now.toISOString()).run();
  return readSiteSettings(db);
}
