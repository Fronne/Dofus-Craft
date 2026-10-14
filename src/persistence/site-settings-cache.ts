import { DEFAULT_SITE_SETTINGS, parseSiteSettings, type SiteSettings } from '../domain/site-settings';

// specs/050-forgemagie-page-toggle FR-009: the site settings as last read on this device, applied
// while they are being read again and when they can't be. Nothing kept means the default.
const STORAGE_KEY = 'craftcheck-site-settings';

export function readCachedSiteSettings(): SiteSettings {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null');
    return parseSiteSettings(stored) ?? DEFAULT_SITE_SETTINGS;
  } catch {
    return DEFAULT_SITE_SETTINGS;
  }
}

export function cacheSiteSettings(settings: SiteSettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage unavailable — the settings are simply read again on the next visit.
  }
}
