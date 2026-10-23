import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SITE_SETTINGS,
  SITE_PAGES,
  enabledPageCount,
  firstEnabledPage,
  isLastEnabledPage,
  parseSiteSettings,
  validateSiteSettingsChange,
  type SiteSettings,
} from '../../src/domain/site-settings';
import { cacheSiteSettings, readCachedSiteSettings } from '../../src/persistence/site-settings-cache';
import { getSiteSettings } from '../../src/services/site-settings-api';

// specs/050-forgemagie-page-toggle, specs/053-hdv-page-toggle, specs/071-admin-dashboard-moderne: the shared rules, the
// device's last known state and the public read, for the seven pages the owner can turn on or off.
const allOff: SiteSettings = Object.fromEntries(SITE_PAGES.map((page) => [page.field, false])) as SiteSettings;
const only = (...fields: (keyof SiteSettings)[]): SiteSettings => ({ ...allOff, ...Object.fromEntries(fields.map((field) => [field, true])) });

describe('site settings rules', () => {
  it('lists the seven pages in the order of the navigation, each with its own storage key', () => {
    expect(SITE_PAGES.map((page) => page.label)).toEqual(['Recherche', 'Suivis', 'Rentabilité', 'HDV', 'XP Familier', 'Forgemagie', 'Brisage']);
    expect(SITE_PAGES.map((page) => page.key)).toEqual(['search_page', 'pinned_page', 'prices_page', 'hdv_page', 'pets_page', 'forgemagie_page', 'brisage_page']);
    expect(new Set(SITE_PAGES.map((page) => page.key)).size).toBe(7);
    expect(new Set(SITE_PAGES.map((page) => page.field)).size).toBe(7);
  });

  it('has the Forgemagie page disabled and the six others enabled by default', () => {
    expect(DEFAULT_SITE_SETTINGS).toEqual({
      searchPage: true, pinnedPage: true, pricesPage: true, hdvPage: true, petsPage: true, forgemagiePage: false, brisagePage: true,
      brisageRanking: false,
    });
  });

  // specs/072-classement-brisage: the ranking is reserved to the owner until the setting is turned on, and is not a page.
  it('keeps the Brisage ranking closed by default and does not count it as a page', () => {
    expect(DEFAULT_SITE_SETTINGS.brisageRanking).toBe(false);
    expect(enabledPageCount({ ...DEFAULT_SITE_SETTINGS, brisageRanking: true })).toBe(enabledPageCount(DEFAULT_SITE_SETTINGS));
    expect(isLastEnabledPage({ ...DEFAULT_SITE_SETTINGS, searchPage: false, pinnedPage: false, pricesPage: false, hdvPage: false, petsPage: false, brisagePage: false, brisageRanking: true }, 'brisageRanking')).toBe(false);
  });

  it.each([
    [{ forgemagiePage: true, hdvPage: false }, { ...DEFAULT_SITE_SETTINGS, forgemagiePage: true, hdvPage: false }],
    [{ forgemagiePage: false, brisagePage: false }, { ...DEFAULT_SITE_SETTINGS, brisagePage: false }],
    // Saved before specs/053 or specs/071: the pages it lacks keep their default.
    [{ forgemagiePage: true }, { ...DEFAULT_SITE_SETTINGS, forgemagiePage: true }],
    [{ forgemagiePage: true, hdvPage: 'non' }, undefined],
    [{ forgemagiePage: true, searchPage: 0 }, undefined],
    [{ hdvPage: false }, undefined],
    [{}, undefined],
    [{ forgemagiePage: 'true' }, undefined],
    [{ forgemagiePage: 1 }, undefined],
    [null, undefined],
    ['oui', undefined],
  ])('reads %j as %j', (value, expected) => {
    expect(parseSiteSettings(value)).toEqual(expected);
  });

  it('accepts a change of one setting or several, and keeps nothing else of the input', () => {
    expect(validateSiteSettingsChange({ hdvPage: false, extra: 1 })).toEqual({ ok: true, value: { hdvPage: false } });
    expect(validateSiteSettingsChange({ brisagePage: false })).toEqual({ ok: true, value: { brisagePage: false } });
    expect(validateSiteSettingsChange({ forgemagiePage: true, searchPage: false, petsPage: true })).toEqual({
      ok: true,
      value: { forgemagiePage: true, searchPage: false, petsPage: true },
    });
  });

  it.each([
    [undefined, 'forgemagiePage'],
    [{}, 'forgemagiePage'],
    [{ extra: true }, 'forgemagiePage'],
    [{ forgemagiePage: 'non' }, 'forgemagiePage'],
    [{ hdvPage: 'non' }, 'hdvPage'],
    [{ brisagePage: 1 }, 'brisagePage'],
    [{ forgemagiePage: true, pinnedPage: 0 }, 'pinnedPage'],
  ])('refuses %j with %s in error', (input, field) => {
    expect(validateSiteSettingsChange(input)).toEqual({ ok: false, field, error: 'Valeur attendue : activée ou désactivée.' });
  });
});

describe('enabledPageCount / firstEnabledPage / isLastEnabledPage', () => {
  it('counts the pages that are on', () => {
    expect(enabledPageCount(DEFAULT_SITE_SETTINGS)).toBe(6);
    expect(enabledPageCount(allOff)).toBe(0);
    expect(enabledPageCount({ ...DEFAULT_SITE_SETTINGS, forgemagiePage: true })).toBe(7);
  });

  it('leads to the first page of the navigation that is on', () => {
    expect(firstEnabledPage(DEFAULT_SITE_SETTINGS)?.label).toBe('Recherche');
    expect(firstEnabledPage({ ...DEFAULT_SITE_SETTINGS, searchPage: false })?.label).toBe('Suivis');
    expect(firstEnabledPage(only('forgemagiePage', 'brisagePage'))?.label).toBe('Forgemagie');
    expect(firstEnabledPage(allOff)).toBeUndefined();
  });

  it('knows when a page is the last one on, and only then', () => {
    expect(isLastEnabledPage(only('brisagePage'), 'brisagePage')).toBe(true);
    expect(isLastEnabledPage(only('brisagePage', 'hdvPage'), 'brisagePage')).toBe(false);
    // A page that is already off is not "the last page on".
    expect(isLastEnabledPage(only('brisagePage'), 'hdvPage')).toBe(false);
    expect(isLastEnabledPage(allOff, 'hdvPage')).toBe(false);
  });
});

describe('last known site settings on this device (specs/050, FR-009)', () => {
  beforeEach(() => window.localStorage.clear());

  it('is the default when nothing was kept', () => {
    expect(readCachedSiteSettings()).toEqual(DEFAULT_SITE_SETTINGS);
  });

  it('gives back what was last kept', () => {
    const kept = { ...DEFAULT_SITE_SETTINGS, forgemagiePage: true, hdvPage: false, brisagePage: false };
    cacheSiteSettings(kept);
    expect(readCachedSiteSettings()).toEqual(kept);
  });

  it('reads settings kept before specs/071 with the new pages enabled, so no page disappears', () => {
    window.localStorage.setItem('craftcheck-site-settings', '{"forgemagiePage":true,"hdvPage":false}');
    expect(readCachedSiteSettings()).toEqual({ ...DEFAULT_SITE_SETTINGS, forgemagiePage: true, hdvPage: false });
  });

  it('reads settings kept before specs/053 with the HDV page enabled', () => {
    window.localStorage.setItem('craftcheck-site-settings', '{"forgemagiePage":true}');
    expect(readCachedSiteSettings()).toEqual({ ...DEFAULT_SITE_SETTINGS, forgemagiePage: true });
  });

  it.each(['nope', '{"forgemagiePage":"yes"}', 'null'])('is the default when what was kept is unreadable (%s)', (stored) => {
    window.localStorage.setItem('craftcheck-site-settings', stored);
    expect(readCachedSiteSettings()).toEqual(DEFAULT_SITE_SETTINGS);
  });
});

describe('getSiteSettings (specs/050)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('resolves the settings from /site-settings', async () => {
    const answer = { ...DEFAULT_SITE_SETTINGS, forgemagiePage: true, hdvPage: false, petsPage: false };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(answer), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(getSiteSettings()).resolves.toEqual(answer);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/site-settings$/);
  });

  it('keeps the pages the service does not know yet enabled (not redeployed yet)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ forgemagiePage: false }), { status: 200 })));
    await expect(getSiteSettings()).resolves.toEqual(DEFAULT_SITE_SETTINGS);
  });

  it.each([
    ['a 500 status', () => Promise.resolve(new Response('', { status: 500 }))],
    ['a network error', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['invalid JSON', () => Promise.resolve(new Response('nope', { status: 200 }))],
    ['an incomplete answer', () => Promise.resolve(new Response('{}', { status: 200 }))],
  ])('resolves undefined, without throwing, on %s', async (_label, response) => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(response));
    await expect(getSiteSettings()).resolves.toBeUndefined();
  });
});
