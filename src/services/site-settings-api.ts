import { isSiteSettings, type SiteSettings } from '../domain/site-settings';

// specs/050-forgemagie-page-toggle: public read of the site settings (contracts/site-settings-api.md).
// Never throws: any failure means "unknown", and the site keeps the last state it knew (FR-009).
const API_URL = import.meta.env.VITE_COMMUNITY_API_URL;

export async function getSiteSettings(): Promise<SiteSettings | undefined> {
  try {
    const response = await fetch(`${API_URL}/site-settings`);
    if (!response.ok) return undefined;
    const payload: unknown = await response.json();
    return isSiteSettings(payload) ? payload : undefined;
  } catch {
    return undefined;
  }
}
