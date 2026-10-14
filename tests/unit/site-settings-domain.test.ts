import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SITE_SETTINGS, parseSiteSettings, validateSiteSettingsChange } from '../../src/domain/site-settings';
import { cacheSiteSettings, readCachedSiteSettings } from '../../src/persistence/site-settings-cache';
import { getSiteSettings } from '../../src/services/site-settings-api';

// specs/050-forgemagie-page-toggle, specs/053-hdv-page-toggle: the shared rules, the device's last
// known state and the public read.
describe('site settings rules (specs/050, specs/053)', () => {
  it('has the Forgemagie page disabled and the HDV page enabled by default (FR-002)', () => {
    expect(DEFAULT_SITE_SETTINGS).toEqual({ forgemagiePage: false, hdvPage: true });
  });

  it.each([
    [{ forgemagiePage: true, hdvPage: false }, { forgemagiePage: true, hdvPage: false }],
    [{ forgemagiePage: false, hdvPage: true }, { forgemagiePage: false, hdvPage: true }],
    // Saved before specs/053: the HDV page keeps its default.
    [{ forgemagiePage: true }, { forgemagiePage: true, hdvPage: true }],
    [{ forgemagiePage: true, hdvPage: 'non' }, undefined],
    [{ hdvPage: false }, undefined],
    [{}, undefined],
    [{ forgemagiePage: 'true' }, undefined],
    [{ forgemagiePage: 1 }, undefined],
    [null, undefined],
    ['oui', undefined],
  ])('reads %j as %j', (value, expected) => {
    expect(parseSiteSettings(value)).toEqual(expected);
  });

  it('accepts a change of one setting or both, and keeps nothing else of the input', () => {
    expect(validateSiteSettingsChange({ hdvPage: false, extra: 1 })).toEqual({ ok: true, value: { hdvPage: false } });
    expect(validateSiteSettingsChange({ forgemagiePage: true })).toEqual({ ok: true, value: { forgemagiePage: true } });
    expect(validateSiteSettingsChange({ forgemagiePage: true, hdvPage: true })).toEqual({ ok: true, value: { forgemagiePage: true, hdvPage: true } });
  });

  it.each([
    [undefined, 'forgemagiePage'],
    [{}, 'forgemagiePage'],
    [{ forgemagiePage: 'non' }, 'forgemagiePage'],
    [{ hdvPage: 'non' }, 'hdvPage'],
    [{ forgemagiePage: true, hdvPage: 0 }, 'hdvPage'],
  ])('refuses %j with %s in error', (input, field) => {
    expect(validateSiteSettingsChange(input)).toEqual({ ok: false, field, error: 'Valeur attendue : activée ou désactivée.' });
  });
});

describe('last known site settings on this device (specs/050, FR-009)', () => {
  beforeEach(() => window.localStorage.clear());

  it('is the default when nothing was kept', () => {
    expect(readCachedSiteSettings()).toEqual(DEFAULT_SITE_SETTINGS);
  });

  it('gives back what was last kept', () => {
    cacheSiteSettings({ forgemagiePage: true, hdvPage: false });
    expect(readCachedSiteSettings()).toEqual({ forgemagiePage: true, hdvPage: false });
  });

  it('reads settings kept before specs/053 with the HDV page enabled', () => {
    window.localStorage.setItem('craftcheck-site-settings', '{"forgemagiePage":true}');
    expect(readCachedSiteSettings()).toEqual({ forgemagiePage: true, hdvPage: true });
  });

  it.each(['nope', '{"forgemagiePage":"yes"}', 'null'])('is the default when what was kept is unreadable (%s)', (stored) => {
    window.localStorage.setItem('craftcheck-site-settings', stored);
    expect(readCachedSiteSettings()).toEqual(DEFAULT_SITE_SETTINGS);
  });
});

describe('getSiteSettings (specs/050)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('resolves the settings from /site-settings', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ forgemagiePage: true, hdvPage: false }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(getSiteSettings()).resolves.toEqual({ forgemagiePage: true, hdvPage: false });
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/site-settings$/);
  });

  it('keeps the HDV page enabled when the service answers without it (not redeployed yet)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ forgemagiePage: false }), { status: 200 })));
    await expect(getSiteSettings()).resolves.toEqual({ forgemagiePage: false, hdvPage: true });
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
