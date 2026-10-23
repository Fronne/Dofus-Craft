import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleApi, type Env } from '../../admin-worker/src/index';
import { readSiteSettings, siteSettingsResponse } from '../../worker/src/site-settings';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { createTestD1 } from '../support/sqlite-d1';
import { DEFAULT_SITE_SETTINGS as ALL_PAGES } from '../../src/domain/site-settings';

// specs/050-forgemagie-page-toggle, contracts/site-settings-api.md: the public read and the
// administration's read and write, on the real schema.
const owner = vi.fn().mockResolvedValue({ email: 'owner@example.com' });
const stranger = vi.fn().mockResolvedValue({ email: 'someone@else.com' });

let env: Env;

function call(method: string, body?: unknown, verify = owner) {
  const request = new Request('https://dofus-craft-admin.example.workers.dev/api/settings', {
    method,
    headers: { 'Cf-Access-Jwt-Assertion': 'jwt', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return handleApi(request, env, verify);
}

beforeEach(() => {
  env = {
    DB: createTestD1().d1 as unknown as Env['DB'],
    ASSETS: { fetch: vi.fn() },
    TEAM_DOMAIN: 'https://dofus.cloudflareaccess.com',
    POLICY_AUD: 'aud',
    OWNER_EMAIL: 'owner@example.com',
  };
});

describe('site settings (specs/050)', () => {
  it('reads the Forgemagie page as disabled while nothing is saved (FR-002)', async () => {
    await expect(readSiteSettings(env.DB)).resolves.toEqual({ ...ALL_PAGES, forgemagiePage: false, hdvPage: true });
    await expect((await call('GET')).json()).resolves.toEqual({ ...ALL_PAGES, forgemagiePage: false, hdvPage: true });
  });

  it('answers the defaults publicly when the settings cannot be read (table not created yet)', async () => {
    const broken = { prepare: () => ({ all: () => Promise.reject(new Error('no such table: site_settings')) }) };
    await expect(siteSettingsResponse(broken)).resolves.toEqual({ ...ALL_PAGES, forgemagiePage: false, hdvPage: true });
    await expect(siteSettingsResponse(env.DB)).resolves.toEqual({ ...ALL_PAGES, forgemagiePage: false, hdvPage: true });
  });

  it.each(['GET', 'PUT'])('refuses %s to anyone but the owner (FR-007)', async (method) => {
    const response = await call(method, method === 'PUT' ? { forgemagiePage: true } : undefined, stranger);
    expect(response.status).toBe(403);
    await expect(readSiteSettings(env.DB)).resolves.toEqual({ ...ALL_PAGES, forgemagiePage: false, hdvPage: true });
  });

  it('enables then disables the page, and the public read follows', async () => {
    await expect((await call('PUT', { forgemagiePage: true })).json()).resolves.toEqual({ ...ALL_PAGES, forgemagiePage: true, hdvPage: true });
    await expect(readSiteSettings(env.DB)).resolves.toEqual({ ...ALL_PAGES, forgemagiePage: true, hdvPage: true });
    await expect((await call('PUT', { forgemagiePage: false })).json()).resolves.toEqual({ ...ALL_PAGES, forgemagiePage: false, hdvPage: true });
    await expect(readSiteSettings(env.DB)).resolves.toEqual({ ...ALL_PAGES, forgemagiePage: false, hdvPage: true });
  });

  it('refuses a value that is not a boolean, with the field in error', async () => {
    const response = await call('PUT', { forgemagiePage: 'oui' });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Valeur attendue : activée ou désactivée.', field: 'forgemagiePage' });
  });
});

// specs/053-hdv-page-toggle: the HDV page setting, next to the Forgemagie one.
describe('HDV page setting (specs/053)', () => {
  it('reads the HDV page as enabled while nothing is saved (FR-002)', async () => {
    await expect(readSiteSettings(env.DB)).resolves.toEqual({ ...ALL_PAGES, forgemagiePage: false, hdvPage: true });
  });

  it('disables then enables the HDV page, and the public read follows', async () => {
    await expect((await call('PUT', { hdvPage: false })).json()).resolves.toEqual({ ...ALL_PAGES, forgemagiePage: false, hdvPage: false });
    await expect(siteSettingsResponse(env.DB)).resolves.toEqual({ ...ALL_PAGES, forgemagiePage: false, hdvPage: false });
    await expect((await call('PUT', { hdvPage: true })).json()).resolves.toEqual({ ...ALL_PAGES, forgemagiePage: false, hdvPage: true });
  });

  it('changes one page without touching the other (FR-010)', async () => {
    await call('PUT', { forgemagiePage: true });
    await call('PUT', { hdvPage: false });
    await expect(readSiteSettings(env.DB)).resolves.toEqual({ ...ALL_PAGES, forgemagiePage: true, hdvPage: false });
    await call('PUT', { forgemagiePage: false });
    await expect(readSiteSettings(env.DB)).resolves.toEqual({ ...ALL_PAGES, forgemagiePage: false, hdvPage: false });
  });

  it('saves both settings at once when both are sent', async () => {
    await expect((await call('PUT', { ...ALL_PAGES, forgemagiePage: true, hdvPage: false })).json()).resolves.toEqual({ ...ALL_PAGES, forgemagiePage: true, hdvPage: false });
  });

  it.each([
    [{ hdvPage: 'non' }, 'hdvPage'],
    [{}, 'forgemagiePage'],
  ])('refuses %j with %s in error, and saves nothing', async (body, field) => {
    const response = await call('PUT', body);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Valeur attendue : activée ou désactivée.', field });
    await expect(readSiteSettings(env.DB)).resolves.toEqual({ ...ALL_PAGES, forgemagiePage: false, hdvPage: true });
  });

  it('migration 0017 keeps the Forgemagie setting saved under 0016 and accepts the HDV key', () => {
    const { DatabaseSync } = createRequire(resolve(process.cwd(), 'package.json'))('node:sqlite') as typeof import('node:sqlite');
    const db = new DatabaseSync(':memory:');
    const migration = (name: string) => readFileSync(resolve(process.cwd(), 'worker/migrations', name), 'utf8');
    db.exec(migration('0016_add_site_settings.sql'));
    db.prepare("INSERT INTO site_settings (key, value, updated_at) VALUES ('forgemagie_page', '1', '2026-10-12T00:00:00.000Z')").run();
    expect(() => db.prepare("INSERT INTO site_settings (key, value, updated_at) VALUES ('hdv_page', '0', 'x')").run()).toThrow();
    db.exec(migration('0017_add_hdv_page_setting.sql'));
    db.prepare("INSERT INTO site_settings (key, value, updated_at) VALUES ('hdv_page', '0', '2026-10-14T00:00:00.000Z')").run();
    expect(db.prepare('SELECT key, value FROM site_settings ORDER BY key').all()).toEqual([
      { key: 'forgemagie_page', value: '1' },
      { key: 'hdv_page', value: '0' },
    ]);
    expect(() => db.prepare("INSERT INTO site_settings (key, value, updated_at) VALUES ('other', '1', 'x')").run()).toThrow();
  });

describe('the seven pages (specs/071)', () => {
  it('reads the six other pages as enabled while nothing is saved', async () => {
    await expect(readSiteSettings(env.DB)).resolves.toEqual({
      searchPage: true, pinnedPage: true, pricesPage: true, hdvPage: true, petsPage: true, forgemagiePage: false, brisagePage: true, brisageRanking: false,
    });
  });

  // specs/072-classement-brisage: the ranking setting is saved and read back like a page, without touching the others.
  it('saves the Brisage ranking setting alone', async () => {
    await expect((await call('PUT', { brisageRanking: true })).json()).resolves.toMatchObject({ brisageRanking: true, brisagePage: true, searchPage: true });
    await expect(readSiteSettings(env.DB)).resolves.toMatchObject({ brisageRanking: true });
    await expect((await call('PUT', { brisageRanking: false })).json()).resolves.toMatchObject({ brisageRanking: false });
  });

  it('turns any of the seven pages off and on, one at a time, leaving the others as they are', async () => {
    await expect((await call('PUT', { brisagePage: false })).json()).resolves.toMatchObject({ brisagePage: false, searchPage: true, hdvPage: true });
    await expect((await call('PUT', { searchPage: false })).json()).resolves.toMatchObject({ searchPage: false, brisagePage: false, pinnedPage: true });
    await expect(readSiteSettings(env.DB)).resolves.toMatchObject({ searchPage: false, brisagePage: false, pinnedPage: true, pricesPage: true, petsPage: true });
    await expect((await call('PUT', { brisagePage: true })).json()).resolves.toMatchObject({ brisagePage: true, searchPage: false });
  });

  it('writes several pages together', async () => {
    await expect((await call('PUT', { pinnedPage: false, pricesPage: false, petsPage: false })).json()).resolves.toMatchObject({
      pinnedPage: false, pricesPage: false, petsPage: false, searchPage: true,
    });
  });

  it('keeps one row per page in the table, under its own key', async () => {
    await call('PUT', { searchPage: false, pinnedPage: false, pricesPage: false, hdvPage: false, petsPage: false, forgemagiePage: true, brisagePage: false });
    const db = env.DB as unknown as { prepare(sql: string): { all<T>(): Promise<{ results: T[] }> } };
    await expect(db.prepare('SELECT key, value FROM site_settings ORDER BY key').all<{ key: string; value: string }>()).resolves.toEqual({
      results: [
        { key: 'brisage_page', value: '0' },
        { key: 'forgemagie_page', value: '1' },
        { key: 'hdv_page', value: '0' },
        { key: 'pets_page', value: '0' },
        { key: 'pinned_page', value: '0' },
        { key: 'prices_page', value: '0' },
        { key: 'search_page', value: '0' },
      ],
    });
  });

  it('refuses a page that is not a boolean, naming it', async () => {
    const response = await call('PUT', { petsPage: 'non' });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Valeur attendue : activée ou désactivée.', field: 'petsPage' });
  });
});
});
