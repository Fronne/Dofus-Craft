import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleApi, type Env } from '../../admin-worker/src/index';
import { readSiteSettings, siteSettingsResponse } from '../../worker/src/site-settings';
import { createTestD1 } from '../support/sqlite-d1';

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
    await expect(readSiteSettings(env.DB)).resolves.toEqual({ forgemagiePage: false });
    await expect((await call('GET')).json()).resolves.toEqual({ forgemagiePage: false });
  });

  it('answers the defaults publicly when the settings cannot be read (table not created yet)', async () => {
    const broken = { prepare: () => ({ first: () => Promise.reject(new Error('no such table: site_settings')) }) };
    await expect(siteSettingsResponse(broken)).resolves.toEqual({ forgemagiePage: false });
    await expect(siteSettingsResponse(env.DB)).resolves.toEqual({ forgemagiePage: false });
  });

  it.each(['GET', 'PUT'])('refuses %s to anyone but the owner (FR-007)', async (method) => {
    const response = await call(method, method === 'PUT' ? { forgemagiePage: true } : undefined, stranger);
    expect(response.status).toBe(403);
    await expect(readSiteSettings(env.DB)).resolves.toEqual({ forgemagiePage: false });
  });

  it('enables then disables the page, and the public read follows', async () => {
    await expect((await call('PUT', { forgemagiePage: true })).json()).resolves.toEqual({ forgemagiePage: true });
    await expect(readSiteSettings(env.DB)).resolves.toEqual({ forgemagiePage: true });
    await expect((await call('PUT', { forgemagiePage: false })).json()).resolves.toEqual({ forgemagiePage: false });
    await expect(readSiteSettings(env.DB)).resolves.toEqual({ forgemagiePage: false });
  });

  it('refuses a value that is not a boolean, with the field in error', async () => {
    const response = await call('PUT', { forgemagiePage: 'oui' });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Valeur attendue : activée ou désactivée.', field: 'forgemagiePage' });
  });
});
