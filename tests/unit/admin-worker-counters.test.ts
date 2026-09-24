import { beforeEach, describe, expect, it, vi } from 'vitest';
import worker, { handleApi, type Env } from '../../admin-worker/src/index';
import { INSERT_COLUMNS } from '../../admin-worker/src/counters';
import type { PlayerCounterRow } from '../../worker/src/player-counters';

// In-memory stand-in for D1, answering the exact statements admin-worker/src/counters.ts sends.
function fakeDb(initial: PlayerCounterRow[]) {
  const rows = new Map(initial.map((row) => [row.id, { ...row }]));
  const statement = (sql: string, values: unknown[] = []) => ({
    bind: (...bound: unknown[]) => statement(sql, bound),
    async all<T>() {
      return { results: [...rows.values()].sort((a, b) => a.created_at.localeCompare(b.created_at)) as T[] };
    },
    async first<T>() {
      return (rows.get(values[0] as string) ?? null) as T | null;
    },
    async run() {
      if (sql.startsWith('INSERT')) {
        const row = Object.fromEntries(INSERT_COLUMNS.map((column, index) => [column, values[index]])) as PlayerCounterRow;
        rows.set(row.id, row);
        return { meta: { changes: 1 } };
      }
      if (sql.startsWith('UPDATE')) {
        const id = values[values.length - 1] as string;
        const row = rows.get(id);
        if (!row) return { meta: { changes: 0 } };
        const columns = sql.slice(sql.indexOf('SET ') + 4, sql.indexOf(' WHERE')).split(', ').map((part) => part.split(' = ')[0]);
        columns.forEach((column, index) => Object.assign(row, { [column]: values[index] }));
        return { meta: { changes: 1 } };
      }
      if (sql.startsWith('DELETE')) return { meta: { changes: rows.delete(values[0] as string) ? 1 : 0 } };
      throw new Error(`Unexpected statement: ${sql}`);
    },
  });
  return { rows, db: { prepare: (sql: string) => statement(sql) } };
}

const nicomoux: PlayerCounterRow = {
  id: 'nicomoux',
  player: 'Nicomoux',
  breed_id: 12,
  sex: 'm',
  count: 157,
  at_least: 0,
  unit_one: 'tentative de FM',
  unit_many: 'tentatives de FM',
  target_item_id: 14094,
  target_name: 'Amulette du Strigide',
  target_icon: 'https://api.dofusdb.fr/img/items/1235.png',
  created_at: '2026-09-24T00:00:01.000Z',
  updated_at: '2026-09-24T00:00:01.000Z',
};

const newCounter = {
  player: 'Glyphinette',
  breedId: 17,
  sex: 'f',
  count: 3,
  atLeast: false,
  unitOne: 'Dofus raté',
  unitMany: 'Dofus ratés',
  target: { itemId: 14094, name: 'Amulette du Strigide', icon: 'https://api.dofusdb.fr/img/items/1235.png' },
};

const owner = vi.fn().mockResolvedValue({ email: 'owner@example.com' });
const stranger = vi.fn().mockResolvedValue({ email: 'someone@else.com' });

let store: ReturnType<typeof fakeDb>;
let env: Env;

function call(method: string, path: string, body?: unknown, verify = owner) {
  const request = new Request(`https://dofus-craft-admin.example.workers.dev${path}`, {
    method,
    headers: { 'Cf-Access-Jwt-Assertion': 'jwt', 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return handleApi(request, env, verify);
}

beforeEach(() => {
  store = fakeDb([nicomoux]);
  env = {
    DB: store.db,
    ASSETS: { fetch: vi.fn().mockResolvedValue(new Response('<html>admin</html>')) },
    TEAM_DOMAIN: 'https://dofus.cloudflareaccess.com',
    POLICY_AUD: 'aud',
    OWNER_EMAIL: 'owner@example.com',
  };
});

describe('US1 — changer le chiffre (specs/014-admin-counters)', () => {
  it('lists the counters', async () => {
    const response = await call('GET', '/api/counters');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject([{ id: 'nicomoux', count: 157, atLeast: false }]);
  });

  it('updates the count and "at least", and dates the change', async () => {
    const response = await call('PATCH', '/api/counters/nicomoux', { count: 162, atLeast: true });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ count: 162, atLeast: true });
    expect(store.rows.get('nicomoux')).toMatchObject({ count: 162, at_least: 1 });
    expect(store.rows.get('nicomoux')?.updated_at).not.toBe(nicomoux.updated_at);
  });

  it('refuses an invalid count, naming the field, without changing anything', async () => {
    const response = await call('PATCH', '/api/counters/nicomoux', { count: -4 });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ field: 'count' });
    expect(store.rows.get('nicomoux')?.count).toBe(157);
  });

  it('answers 404 for an unknown counter', async () => {
    expect((await call('PATCH', '/api/counters/nobody', { count: 1 })).status).toBe(404);
  });

  it('tells the page who is signed in', async () => {
    expect(await (await call('GET', '/api/me')).json()).toEqual({ email: 'owner@example.com' });
  });
});

describe('US2 — accès réservé (FR-007)', () => {
  it.each([
    ['GET', '/api/me', undefined],
    ['GET', '/api/counters', undefined],
    ['POST', '/api/counters', newCounter],
    ['PATCH', '/api/counters/nicomoux', { count: 0 }],
    ['DELETE', '/api/counters/nicomoux', undefined],
  ])('refuses %s %s to anyone but the owner, without touching the data', async (method, path, body) => {
    const response = await call(method, path, body, stranger);
    expect(response.status).toBe(403);
    expect(store.rows.size).toBe(1);
    expect(store.rows.get('nicomoux')).toEqual(nicomoux);
  });

  it('serves the page itself without calling the API check (Access guards it upstream)', async () => {
    const response = await worker.fetch(new Request('https://dofus-craft-admin.example.workers.dev/'), env);
    expect(await response.text()).toContain('admin');
    expect(env.ASSETS.fetch).toHaveBeenCalled();
  });

  it('routes /api/* through the owner check even without an Access token', async () => {
    const response = await worker.fetch(new Request('https://dofus-craft-admin.example.workers.dev/api/counters'), env);
    expect(response.status).toBe(403);
  });
});

describe('US3 — ajouter un compteur', () => {
  it('creates a complete counter', async () => {
    const response = await call('POST', '/api/counters', newCounter);
    expect(response.status).toBe(201);
    const created = await response.json();
    expect(created).toMatchObject({ player: 'Glyphinette', breedId: 17, sex: 'f', count: 3 });
    expect(typeof created.id).toBe('string');
    expect(store.rows.size).toBe(2);
  });

  it('refuses a counter with a missing field, naming it, and inserts nothing', async () => {
    const response = await call('POST', '/api/counters', { ...newCounter, unitMany: '' });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ field: 'unitMany' });
    expect(store.rows.size).toBe(1);
  });
});

describe('US4 — supprimer un compteur', () => {
  it('deletes a counter', async () => {
    expect((await call('DELETE', '/api/counters/nicomoux')).status).toBe(204);
    expect(store.rows.size).toBe(0);
  });

  it('answers 404 for an unknown counter', async () => {
    expect((await call('DELETE', '/api/counters/nobody')).status).toBe(404);
  });
});
