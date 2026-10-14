// specs/050-forgemagie-page-toggle, specs/053-hdv-page-toggle (data-model.md): the owner's site
// settings, shared by the public site, the administration page and both Workers. A setting never
// saved has its default: the Forgemagie page off, the HDV page on.
export type SiteSettings = { forgemagiePage: boolean; hdvPage: boolean };

export const DEFAULT_SITE_SETTINGS: SiteSettings = { forgemagiePage: false, hdvPage: true };

// What the administration sends: only the settings it changes, so one never overwrites the other.
export type SiteSettingsChange = Partial<SiteSettings>;

export type SiteSettingsValidation =
  | { ok: true; value: SiteSettingsChange }
  | { ok: false; field: keyof SiteSettings; error: string };

const INVALID_VALUE = 'Valeur attendue : activée ou désactivée.';

// Settings read from the service or kept on this device. Settings saved before specs/053 have no
// `hdvPage`: they get its default, so the HDV page doesn't disappear for them.
export function parseSiteSettings(value: unknown): SiteSettings | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const { forgemagiePage, hdvPage } = value as Record<string, unknown>;
  if (typeof forgemagiePage !== 'boolean') return undefined;
  if (hdvPage === undefined) return { forgemagiePage, hdvPage: DEFAULT_SITE_SETTINGS.hdvPage };
  if (typeof hdvPage !== 'boolean') return undefined;
  return { forgemagiePage, hdvPage };
}

export function validateSiteSettingsChange(input: unknown): SiteSettingsValidation {
  if (typeof input !== 'object' || input === null) return { ok: false, field: 'forgemagiePage', error: INVALID_VALUE };
  const record = input as Record<string, unknown>;
  const change: SiteSettingsChange = {};
  for (const field of ['forgemagiePage', 'hdvPage'] as const) {
    if (record[field] === undefined) continue;
    if (typeof record[field] !== 'boolean') return { ok: false, field, error: INVALID_VALUE };
    change[field] = record[field];
  }
  if (Object.keys(change).length === 0) return { ok: false, field: 'forgemagiePage', error: INVALID_VALUE };
  return { ok: true, value: change };
}
