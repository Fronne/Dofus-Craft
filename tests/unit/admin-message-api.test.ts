import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleApi, type Env } from '../../admin-worker/src/index';
import { createTestD1 } from '../support/sqlite-d1';

// specs/020-info-banner, contracts/info-message-api.md « Administration ».
const owner = vi.fn().mockResolvedValue({ email: 'owner@example.com' });
const stranger = vi.fn().mockResolvedValue({ email: 'someone@else.com' });
const message = { text: 'Maintenance mardi', tone: 'important', endsAt: null };

let env: Env;

function call(method: string, body?: unknown, verify = owner) {
  const request = new Request('https://dofus-craft-admin.example.workers.dev/api/message', {
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

describe('/api/message (specs/020)', () => {
  it.each(['GET', 'PUT', 'DELETE'])('refuses %s to anyone but the owner', async (method) => {
    const response = await call(method, method === 'PUT' ? message : undefined, stranger);
    expect(response.status).toBe(403);
  });

  it('publishes, replaces with a new version, and reads the message back', async () => {
    const first = await (await call('PUT', message)).json();
    expect(first).toMatchObject({ text: 'Maintenance mardi', tone: 'important', endsAt: null });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await (await call('PUT', { ...message, tone: 'info', text: 'Bonne semaine' })).json();
    expect(second.version).not.toBe(first.version);
    await expect((await call('GET')).json()).resolves.toEqual(second);
  });

  it('refuses an invalid message with the field in error', async () => {
    const response = await call('PUT', { text: '', tone: 'info' });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Le message ne peut pas être vide.', field: 'text' });
  });

  it('removes the message', async () => {
    await call('PUT', message);
    expect((await call('DELETE')).status).toBe(204);
    await expect((await call('GET')).json()).resolves.toBeNull();
  });

  it('still returns an expired message to the editor', async () => {
    await (env.DB as unknown as ReturnType<typeof createTestD1>['d1'])
      .prepare("INSERT INTO info_message (id, text, tone, ends_at, updated_at) VALUES ('current', 'Vieux', 'info', '2020-01-01T00:00:00.000Z', '2019-12-01T00:00:00.000Z')")
      .run();
    await expect((await call('GET')).json()).resolves.toMatchObject({ text: 'Vieux', endsAt: '2020-01-01T00:00:00.000Z' });
  });
});
