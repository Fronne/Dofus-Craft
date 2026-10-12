// specs/050-forgemagie-page-toggle (data-model.md): the owner's site settings, shared by the public
// site, the administration page and both Workers. Nothing saved means the default.
export type SiteSettings = { forgemagiePage: boolean };

export const DEFAULT_SITE_SETTINGS: SiteSettings = { forgemagiePage: false };

export type SiteSettingsValidation = { ok: true; value: SiteSettings } | { ok: false; field: 'forgemagiePage'; error: string };

export function isSiteSettings(value: unknown): value is SiteSettings {
  return typeof value === 'object' && value !== null && typeof (value as Record<string, unknown>).forgemagiePage === 'boolean';
}

export function validateSiteSettingsInput(input: unknown): SiteSettingsValidation {
  if (!isSiteSettings(input)) return { ok: false, field: 'forgemagiePage', error: 'Valeur attendue : activée ou désactivée.' };
  return { ok: true, value: { forgemagiePage: input.forgemagiePage } };
}
