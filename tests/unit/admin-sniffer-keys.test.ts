import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleApi, type Env } from '../../admin-worker/src/index';
import { createKey, listKeys, revokeKey } from '../../admin-worker/src/sniffer-keys';
import { sha256Hex } from '../../worker/src/fm/http';
import { handleSniffer, type SnifferEnv } from '../../worker/src/sniffer';
import { createTestD1 } from '../support/sqlite-d1';

// specs/057-sniffer-admin (contracts/admin-sniffer-api.md « Clés »): the friends' keys, created and
// revoked from the administration, checked against the API of specs/056 on the real schema.
const owner = vi.fn().mockResolvedValue({ email: 'owner@example.com' });
const stranger = vi.fn().mockResolvedValue({ email: 'someone@else.com' });

let test: ReturnType<typeof createTestD1>;
let env: Env;

function call(method: string, path: string, body?: unknown, verify = owner) {
  const request = new Request(`https://dofus-craft-admin.example.workers.dev${path}`, {
    method,
    headers: { 'Cf-Access-Jwt-Assertion': 'jwt', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return handleApi(request, env, verify);
}

// GET /sniffer/config of the community price API, with a friend's key.
async function configStatus(secret: string): Promise<number> {
  const snifferEnv: SnifferEnv = { DB: test.d1 };
  const url = new URL('https://api.test/sniffer/config?build=3.7.10.10');
  const result = await handleSniffer(new Request(url, { headers: { Authorization: `Bearer ${secret}` } }), url, snifferEnv);
  return result!.status;
}

const storedKeys = () => test.sqlite.prepare('SELECT * FROM sniffer_keys').all() as Record<string, unknown>[];

beforeEach(() => {
  test = createTestD1();
  env = {
    DB: test.d1 as unknown as Env['DB'],
    ASSETS: { fetch: vi.fn() },
    TEAM_DOMAIN: 'https://dofus.cloudflareaccess.com',
    POLICY_AUD: 'aud',
    OWNER_EMAIL: 'owner@example.com',
  };
});

describe('sniffer keys (specs/057, US1)', () => {
  it('creates a key whose secret is answered once and only its SHA-256 stored (FR-002, FR-003)', async () => {
    const response = await call('POST', '/api/sniffer/keys', { label: '  Alice  ' });
    expect(response.status).toBe(201);
    const { key, secret } = await response.json() as { key: Record<string, unknown>; secret: string };
    expect(secret).toMatch(/^dcp_[0-9a-f]{64}$/);
    expect(key).toMatchObject({ label: 'Alice', revokedAt: null, lastSeenAt: null, rowsToday: 0 });
    expect(key).not.toHaveProperty('secret');
    expect(key).not.toHaveProperty('keyHash');

    const [row] = storedKeys();
    expect(row.id).toBe(key.id);
    expect(row.key_hash).toBe(await sha256Hex(secret));
    expect(JSON.stringify(storedKeys())).not.toContain(secret);

    const listed = await (await call('GET', '/api/sniffer/keys')).text();
    expect(listed).not.toContain(secret);
    expect(listed).not.toContain(String(row.key_hash));
  });

  it('gives a key the community price API accepts, then shows its last call (SC-001, FR-005)', async () => {
    const { secret } = await (await call('POST', '/api/sniffer/keys', { label: 'Alice' })).json() as { secret: string };
    expect(await configStatus(secret)).toBe(200);
    const [listed] = await (await call('GET', '/api/sniffer/keys')).json() as { lastSeenAt: string | null }[];
    expect(listed.lastSeenAt).not.toBeNull();
    expect(await configStatus(`${secret}x`)).toBe(401);
  });

  it.each([[''], ['   '], ['x'.repeat(61)], [undefined], [42]])('refuses the label %j, naming the field (FR-002)', async (label) => {
    const response = await call('POST', '/api/sniffer/keys', { label });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'Libellé obligatoire (60 caractères au plus).', field: 'label' });
    expect(storedKeys()).toEqual([]);
  });

  it('accepts a 60-character label', async () => {
    expect((await call('POST', '/api/sniffer/keys', { label: 'x'.repeat(60) })).status).toBe(201);
  });
});

describe('revoking and listing (specs/057, US2)', () => {
  it('revokes a key: the API refuses it from the next call, and a second revocation keeps the first date (FR-006)', async () => {
    const created = await createKey(env.DB, 'Alice', new Date('2026-10-15T08:00:00.000Z'), 'key-a');
    expect(await configStatus(created.secret)).toBe(200);

    const response = await call('POST', '/api/sniffer/keys/key-a/revoke');
    expect(response.status).toBe(200);
    const revoked = await response.json() as { revokedAt: string };
    expect(revoked.revokedAt).not.toBeNull();
    expect(await configStatus(created.secret)).toBe(401);

    await expect(revokeKey(env.DB, 'key-a', new Date('2030-01-01T00:00:00.000Z'))).resolves.toMatchObject({ revokedAt: revoked.revokedAt });
  });

  it('answers 404 for an unknown key', async () => {
    const response = await call('POST', '/api/sniffer/keys/nope/revoke');
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Clé introuvable.' });
  });

  it("counts only today's (UTC) prices, newest key first, 0 and never for an unused key", async () => {
    await createKey(env.DB, 'Alice', new Date('2026-10-14T08:00:00.000Z'), 'key-a');
    await createKey(env.DB, 'Bob', new Date('2026-10-15T08:00:00.000Z'), 'key-b');
    test.sqlite.prepare('INSERT INTO sniffer_daily_usage (key_id, day, rows_written) VALUES (?, ?, ?)').run('key-a', '2026-10-15', 120);
    test.sqlite.prepare('INSERT INTO sniffer_daily_usage (key_id, day, rows_written) VALUES (?, ?, ?)').run('key-a', '2026-10-14', 900);

    const keys = await listKeys(env.DB, new Date('2026-10-15T23:59:00.000Z'));
    expect(keys.map(({ id, rowsToday, lastSeenAt }) => ({ id, rowsToday, lastSeenAt }))).toEqual([
      { id: 'key-b', rowsToday: 0, lastSeenAt: null },
      { id: 'key-a', rowsToday: 120, lastSeenAt: null },
    ]);
    await expect(listKeys(env.DB, new Date('2026-10-16T00:00:00.000Z'))).resolves.toMatchObject([{ rowsToday: 0 }, { rowsToday: 0 }]);
  });

  it.each([
    ['GET', '/api/sniffer/keys', undefined],
    ['POST', '/api/sniffer/keys', { label: 'Mallory' }],
    ['POST', '/api/sniffer/keys/key-a/revoke', undefined],
  ])('refuses %s %s to anyone but the owner, writing nothing (FR-001)', async (method, path, body) => {
    await createKey(env.DB, 'Alice', new Date('2026-10-15T08:00:00.000Z'), 'key-a');
    const response = await call(method, path, body, stranger);
    expect(response.status).toBe(403);
    expect(storedKeys()).toMatchObject([{ id: 'key-a', revoked_at: null }]);
  });
});
