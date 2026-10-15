import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleApi, type Env } from '../../admin-worker/src/index';
import { MAX_DOCUMENT_BYTES, validateMappingUpload } from '../../admin-worker/src/sniffer-mappings';
import { sha256Hex } from '../../worker/src/fm/http';
import { handleSniffer, type SnifferEnv } from '../../worker/src/sniffer';
import { createTestD1 } from '../support/sqlite-d1';

// specs/057-sniffer-admin (contracts/admin-sniffer-api.md « Mappings »): publishing keymap.json +
// schema.json per client build, and going back to an older one, checked against GET /sniffer/config
// and POST /community-price/batch of specs/056 on the real schema.
const owner = vi.fn().mockResolvedValue({ email: 'owner@example.com' });
const stranger = vi.fn().mockResolvedValue({ email: 'someone@else.com' });
const KEY = 'friend-key';
const BUILD = '3.7.10.10';

// Shaped like SniffSniffSquared/sniffer/keymap.json and schema.json (2026-10-12 client).
const KEYMAP = JSON.stringify({ _comment: 'notes', price_list: 'jzs' }, null, 2);
const SCHEMA = JSON.stringify({
  _comment: 'notes',
  price_offer: { fields: [{ n: 1, name: 'lots', kind: 'packed' }, { n: 2, name: 'stat', kind: 'message', of: 'price_stat_line', repeated: true }] },
  price_stat_line: { fields: [{ n: 5, name: 'value', kind: 'varint' }] },
  price_list: { _note: 'n', fields: [{ n: 1, name: 'offer', kind: 'message', of: 'price_offer', repeated: true }, { n: 3, name: 'item_id', kind: 'varint' }] },
}, null, 2);

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

async function sniffer(method: string, path: string, body?: unknown) {
  const snifferEnv: SnifferEnv = { DB: test.d1, SNIFFER_MIN_VERSION: '0.1.0' };
  const url = new URL(`https://api.test${path}`);
  const result = await handleSniffer(new Request(url, {
    method, headers: { Authorization: `Bearer ${KEY}` }, body: body === undefined ? undefined : JSON.stringify(body),
  }), url, snifferEnv);
  return result!;
}

const config = async (build = BUILD) => (await sniffer('GET', `/sniffer/config?build=${build}`)).body as { mapping: { id: number; keymap: unknown; schema: unknown } | null };
const upload = async (fields: Record<string, unknown> = {}) => call('POST', '/api/sniffer/mappings', { build: BUILD, keymap: KEYMAP, schema: SCHEMA, ...fields });
const stored = () => test.sqlite.prepare('SELECT id, build, keymap_json, schema_json, active FROM sniffer_mappings ORDER BY id').all() as
  { id: number; build: string; keymap_json: string; schema_json: string; active: number }[];

beforeEach(async () => {
  test = createTestD1();
  env = {
    DB: test.d1 as unknown as Env['DB'],
    ASSETS: { fetch: vi.fn() },
    TEAM_DOMAIN: 'https://dofus.cloudflareaccess.com',
    POLICY_AUD: 'aud',
    OWNER_EMAIL: 'owner@example.com',
  };
  test.sqlite.prepare('INSERT INTO sniffer_keys (id, label, key_hash) VALUES (?, ?, ?)').run('key-1', 'Ami', await sha256Hex(KEY));
});

describe('validateMappingUpload (specs/057, FR-008)', () => {
  const valid = { build: BUILD, keymap: KEYMAP, schema: SCHEMA };
  const refusal = (fields: Record<string, unknown>) => validateMappingUpload({ ...valid, ...fields });

  it('accepts the documents as uploaded, text unchanged', () => {
    expect(validateMappingUpload(valid)).toEqual({ ok: true, value: valid });
    expect(validateMappingUpload({ ...valid, build: '3.7.10' }).ok).toBe(true);
  });

  it.each(['', '3.7', '1.2.3.4.5', '3.7.10.10 ', 'v3.7.10', '3.7.x.10', `${'1'.repeat(30)}.1.1`, 3710])('refuses the build %j', (build) => {
    expect(refusal({ build })).toEqual({ ok: false, error: 'Build attendu sous la forme 3.7.10.10.', field: 'build' });
  });

  it.each([
    [{ keymap: undefined }, "keymap.json manquant.", 'keymap'],
    [{ keymap: '  ' }, "keymap.json manquant.", 'keymap'],
    [{ keymap: '{"price_list": "jzs"' }, "keymap.json n'est pas du JSON valide.", 'keymap'],
    [{ keymap: '["price_list"]' }, 'keymap.json doit être un objet JSON.', 'keymap'],
    [{ keymap: 'null' }, 'keymap.json doit être un objet JSON.', 'keymap'],
    [{ schema: '{' }, "schema.json n'est pas du JSON valide.", 'schema'],
    [{ schema: '"price_list"' }, 'schema.json doit être un objet JSON.', 'schema'],
    [{ keymap: '{"_price_list": "jzs"}' }, "keymap.json n'a pas d'entrée price_list.", 'keymap'],
    [{ keymap: '{"price_list": ""}' }, "keymap.json n'a pas d'entrée price_list.", 'keymap'],
    [{ keymap: '{"price_list": 12}' }, "keymap.json n'a pas d'entrée price_list.", 'keymap'],
    [{ schema: '{"_price_list": {"fields": []}}' }, "schema.json n'a pas de définition price_list.", 'schema'],
    [{ schema: '{"price_list": "abc"}' }, "schema.json n'a pas de définition price_list.", 'schema'],
    [{ schema: '{"price_list": {"fields": [{"of": "price_offer"}]}}' }, 'schema.json : la définition « price_offer » citée par price_list est absente.', 'schema'],
    [{ schema: '{"price_list": {"fields": [{"of": "a"}]}, "a": {"fields": [{"of": "b"}]}}' }, 'schema.json : la définition « b » citée par price_list est absente.', 'schema'],
    [{ schema: '{"price_list": {"fields": [{"of": "_note"}]}, "_note": {"fields": []}}' }, 'schema.json : la définition « _note » citée par price_list est absente.', 'schema'],
    [{ schema: '{"price_list": {"fields": [{"of": "constructor"}, {"of": "hasOwnProperty"}]}}' }, 'schema.json : la définition « constructor » citée par price_list est absente.', 'schema'],
    [{ schema: '{"price_list": {"fields": [{"of": "valueOf"}]}}' }, 'schema.json : la définition « valueOf » citée par price_list est absente.', 'schema'],
    [{ schema: '{"price_list": {"fields": [{"of": "__proto__"}]}}' }, 'schema.json : la définition « __proto__ » citée par price_list est absente.', 'schema'],
  ])('refuses %j', (fields, error, field) => {
    expect(refusal(fields)).toEqual({ ok: false, error, field });
  });

  it('refuses a document over 256 KB', () => {
    const big = JSON.stringify({ price_list: 'jzs', _pad: 'x'.repeat(MAX_DOCUMENT_BYTES) });
    expect(refusal({ keymap: big })).toEqual({ ok: false, error: 'keymap.json dépasse 256 Ko.', field: 'keymap' });
  });

  it('follows a cycle of `of` without looping', () => {
    const schema = JSON.stringify({ price_list: { fields: [{ of: 'a' }] }, a: { fields: [{ of: 'price_list' }, { of: 'a' }] } });
    expect(refusal({ schema }).ok).toBe(true);
  });
});

describe('publishing a mapping (specs/057, US3)', () => {
  it('makes the upload the active mapping GET /sniffer/config serves, content unchanged (SC-004)', async () => {
    expect((await config()).mapping).toBeNull();
    const response = await upload();
    expect(response.status).toBe(201);
    const mapping = await response.json() as { id: number };
    expect(mapping).toMatchObject({ build: BUILD, active: true, keymapBytes: KEYMAP.length, schemaBytes: SCHEMA.length });

    const served = (await config()).mapping!;
    expect(served.id).toBe(mapping.id);
    expect(served.keymap).toEqual(JSON.parse(KEYMAP));
    expect(served.schema).toEqual(JSON.parse(SCHEMA));
    expect(stored()[0]).toMatchObject({ keymap_json: KEYMAP, schema_json: SCHEMA });
  });

  it('replaces the active mapping of the same build only (FR-009)', async () => {
    const other = await (await upload({ build: '3.7.9.0' })).json() as { id: number };
    const first = await (await upload()).json() as { id: number };
    const second = await (await upload({ keymap: '{"price_list": "abc"}' })).json() as { id: number };
    expect(stored().map(({ id, build, active }) => ({ id, build, active }))).toEqual([
      { id: other.id, build: '3.7.9.0', active: 1 },
      { id: first.id, build: BUILD, active: 0 },
      { id: second.id, build: BUILD, active: 1 },
    ]);
    expect((await config()).mapping!.id).toBe(second.id);
    expect((await config('3.7.9.0')).mapping!.id).toBe(other.id);
  });

  it('refuses an invalid upload, writing nothing and naming the document', async () => {
    await upload();
    const before = stored();
    const response = await upload({ schema: '{"price_list": {"fields": [{"of": "missing"}]}}' });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'schema.json : la définition « missing » citée par price_list est absente.', field: 'schema' });
    expect(stored()).toEqual(before);
  });

  it('lists the history grouped by build, the build uploaded to last first (FR-011)', async () => {
    const a = await (await upload()).json() as { id: number };
    const b = await (await upload({ build: '3.7.11.0' })).json() as { id: number };
    const c = await (await upload()).json() as { id: number };
    const listed = await (await call('GET', '/api/sniffer/mappings')).json() as { id: number; build: string; active: boolean }[];
    expect(listed.map(({ id, build, active }) => ({ id, build, active }))).toEqual([
      { id: c.id, build: BUILD, active: true },
      { id: a.id, build: BUILD, active: false },
      { id: b.id, build: '3.7.11.0', active: true },
    ]);
    expect(listed[0]).not.toHaveProperty('keymap');
  });

  it.each([
    ['GET', '/api/sniffer/mappings', undefined],
    ['POST', '/api/sniffer/mappings', { build: BUILD, keymap: KEYMAP, schema: SCHEMA }],
    ['POST', '/api/sniffer/mappings/1/activate', undefined],
  ])('refuses %s %s to anyone but the owner, writing nothing (FR-001)', async (method, path, body) => {
    const response = await call(method, path, body, stranger);
    expect(response.status).toBe(403);
    expect(stored()).toEqual([]);
  });
});

describe('going back to an older mapping (specs/057, US4)', () => {
  it('makes the older one active: config serves it and a batch with the newer id gets 409 (FR-012)', async () => {
    const a = await (await upload()).json() as { id: number };
    const b = await (await upload({ keymap: '{"price_list": "abc"}' })).json() as { id: number };

    const response = await call('POST', `/api/sniffer/mappings/${a.id}/activate`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ id: a.id, active: true });
    expect((await config()).mapping!.id).toBe(a.id);
    expect(stored().filter((row) => row.active === 1).map((row) => row.id)).toEqual([a.id]);

    const batch = await sniffer('POST', '/community-price/batch', { tool: '0.1.0', build: BUILD, mappingId: b.id, serverId: 'mikhal', observations: [] });
    expect(batch).toMatchObject({ status: 409, body: { error: 'mapping_not_active', activeMappingId: a.id } });
  });

  it('changes nothing when the mapping is already active', async () => {
    const a = await (await upload()).json() as { id: number };
    const before = stored();
    expect((await call('POST', `/api/sniffer/mappings/${a.id}/activate`)).status).toBe(200);
    expect(stored()).toEqual(before);
  });

  it('answers 404 for an unknown mapping', async () => {
    const response = await call('POST', '/api/sniffer/mappings/999/activate');
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'Mapping introuvable.' });
  });
});
