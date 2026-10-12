import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SITE_SETTINGS, isSiteSettings, validateSiteSettingsInput } from '../../src/domain/site-settings';
import { cacheSiteSettings, readCachedSiteSettings } from '../../src/persistence/site-settings-cache';
import { getSiteSettings } from '../../src/services/site-settings-api';

// specs/050-forgemagie-page-toggle: the shared rules, the device's last known state and the public read.
describe('site settings rules (specs/050)', () => {
  it('has the Forgemagie page disabled by default (FR-002)', () => {
    expect(DEFAULT_SITE_SETTINGS).toEqual({ forgemagiePage: false });
  });

  it.each([
    [{ forgemagiePage: true }, true],
    [{ forgemagiePage: false }, true],
    [{}, false],
    [{ forgemagiePage: 'true' }, false],
    [{ forgemagiePage: 1 }, false],
    [null, false],
    ['oui', false],
  ])('recognises %j as settings: %s', (value, expected) => {
    expect(isSiteSettings(value)).toBe(expected);
  });

  it('accepts a boolean and keeps nothing else of the input', () => {
    expect(validateSiteSettingsInput({ forgemagiePage: true, extra: 1 })).toEqual({ ok: true, value: { forgemagiePage: true } });
  });

  it.each([[undefined], [{}], [{ forgemagiePage: 'non' }]])('refuses %j with the field in error', (input) => {
    expect(validateSiteSettingsInput(input)).toEqual({ ok: false, field: 'forgemagiePage', error: 'Valeur attendue : activée ou désactivée.' });
  });
});

describe('last known site settings on this device (specs/050, FR-009)', () => {
  beforeEach(() => window.localStorage.clear());

  it('is the default when nothing was kept', () => {
    expect(readCachedSiteSettings()).toEqual(DEFAULT_SITE_SETTINGS);
  });

  it('gives back what was last kept', () => {
    cacheSiteSettings({ forgemagiePage: true });
    expect(readCachedSiteSettings()).toEqual({ forgemagiePage: true });
  });

  it.each(['nope', '{"forgemagiePage":"yes"}', 'null'])('is the default when what was kept is unreadable (%s)', (stored) => {
    window.localStorage.setItem('craftcheck-site-settings', stored);
    expect(readCachedSiteSettings()).toEqual(DEFAULT_SITE_SETTINGS);
  });
});

describe('getSiteSettings (specs/050)', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('resolves the settings from /site-settings', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ forgemagiePage: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(getSiteSettings()).resolves.toEqual({ forgemagiePage: true });
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/site-settings$/);
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
