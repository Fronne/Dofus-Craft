import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleApi, type Env } from '../../admin-worker/src/index';
import { readKeyContributions, validateMonth, type KeyContributions } from '../../admin-worker/src/sniffer-contributions';
import { createTestD1 } from '../support/sqlite-d1';

// specs/070-admin-dashboard-graphiques (data-model.md « Lignes ajoutées par clé », contracts/admin-dashboard-api.md).
const NOW = new Date('2026-10-22T14:37:05.000Z');
const owner = vi.fn().mockResolvedValue({ email: 'owner@example.com' });
const stranger = vi.fn().mockResolvedValue({ email: 'someone@else.com' });

let test: ReturnType<typeof createTestD1>;
let env: Env;

function addKey(id: string, label: string, createdAt = '2026-01-01T00:00:00.000Z', revokedAt: string | null = null) {
  test.sqlite.prepare('INSERT INTO sniffer_keys (id, label, key_hash, created_at, revoked_at) VALUES (?, ?, ?, ?, ?)')
    .run(id, label, `hash-of-${id}`, createdAt, revokedAt);
}

function addUsage(keyId: string, day: string, rows: number) {
  test.sqlite.prepare('INSERT INTO sniffer_daily_usage (key_id, day, rows_written) VALUES (?, ?, ?)').run(keyId, day, rows);
}

function call(path: string, verify = owner) {
  const request = new Request(`https://dofus-craft-admin.example.workers.dev${path}`, { headers: { 'Cf-Access-Jwt-Assertion': 'jwt' } });
  return handleApi(request, env, verify);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  test = createTestD1();
  env = {
    DB: test.d1 as unknown as Env['DB'],
    ASSETS: { fetch: vi.fn() },
    TEAM_DOMAIN: 'https://dofus.cloudflareaccess.com',
    POLICY_AUD: 'aud',
    OWNER_EMAIL: 'owner@example.com',
  };
});

describe('validateMonth', () => {
  it('takes the current month (UTC) when none is asked', () => {
    expect(validateMonth(null, NOW)).toEqual({ ok: true, value: '2026-10' });
  });

  it('accepts a past or the current month', () => {
    expect(validateMonth('2026-09', NOW)).toEqual({ ok: true, value: '2026-09' });
    expect(validateMonth('2026-10', NOW)).toEqual({ ok: true, value: '2026-10' });
    expect(validateMonth('2025-01', NOW)).toEqual({ ok: true, value: '2025-01' });
  });

  it.each(['2026-13', '2026-00', '26-10', '2026-1', '2026-10-01', 'octobre', '', '2026-11', '2027-01'])('refuses %j', (raw) => {
    expect(validateMonth(raw, NOW)).toEqual({ ok: false, error: 'Mois attendu sous la forme 2026-10.', field: 'month' });
  });
});

describe('readKeyContributions', () => {
  it('adds up each key\'s rows over the month, and the month\'s total', async () => {
    addKey('a', 'Alice');
    addKey('b', 'Bob');
    addUsage('a', '2026-10-01', 100);
    addUsage('a', '2026-10-21', 20);
    addUsage('b', '2026-10-21', 30);
    // Outside the month: not counted.
    addUsage('a', '2026-09-30', 999);
    const result = await readKeyContributions(env.DB, '2026-10', NOW);
    expect(result.total).toBe(150);
    expect(result.keys).toEqual([
      { keyId: 'a', label: 'Alice', revoked: false, rows: 120 },
      { keyId: 'b', label: 'Bob', revoked: false, rows: 30 },
    ]);
  });

  it('lists an active key without any row this month at 0, after the others', async () => {
    addKey('a', 'Alice');
    addKey('z', 'Zoé');
    addUsage('a', '2026-10-05', 7);
    const result = await readKeyContributions(env.DB, '2026-10', NOW);
    expect(result.keys.map((key) => [key.label, key.rows])).toEqual([['Alice', 7], ['Zoé', 0]]);
  });

  it('keeps the rows of a revoked key in the month they were added, and says it is revoked', async () => {
    addKey('a', 'Alice');
    addKey('b', 'Bob', '2026-01-01T00:00:00.000Z', '2026-10-10T00:00:00.000Z');
    addUsage('a', '2026-10-02', 10);
    addUsage('b', '2026-10-02', 30);
    const result = await readKeyContributions(env.DB, '2026-10', NOW);
    expect(result.total).toBe(40);
    expect(result.keys[0]).toEqual({ keyId: 'b', label: 'Bob', revoked: true, rows: 30 });
  });

  it('leaves out a revoked key that added nothing this month, and a key not yet created then', async () => {
    addKey('a', 'Alice');
    addKey('b', 'Bob', '2026-01-01T00:00:00.000Z', '2026-08-10T00:00:00.000Z');
    addKey('c', 'Carole', '2026-10-15T00:00:00.000Z');
    addUsage('a', '2026-09-02', 10);
    addUsage('b', '2026-08-05', 2);
    // September: Bob (revoked in August, nothing added) and Carole (created in October) are not listed.
    const september = await readKeyContributions(env.DB, '2026-09', NOW);
    expect(september.keys.map((key) => key.label)).toEqual(['Alice']);
    // August: Bob added rows before his revocation, so he is listed, with Alice at 0.
    const august = await readKeyContributions(env.DB, '2026-08', NOW);
    expect(august.keys.map((key) => [key.label, key.rows])).toEqual([['Bob', 2], ['Alice', 0]]);
  });

  it('breaks ties between equal counts by label', async () => {
    addKey('b', 'Bob');
    addKey('a', 'Alice');
    addUsage('a', '2026-10-02', 5);
    addUsage('b', '2026-10-02', 5);
    expect((await readKeyContributions(env.DB, '2026-10', NOW)).keys.map((key) => key.label)).toEqual(['Alice', 'Bob']);
  });

  it('gives one point per day up to today for the current month, the days without rows at 0', async () => {
    addKey('a', 'Alice');
    addUsage('a', '2026-10-01', 12);
    addUsage('a', '2026-10-22', 4);
    const { days } = await readKeyContributions(env.DB, '2026-10', NOW);
    expect(days).toHaveLength(22);
    expect(days[0]).toEqual({ date: '2026-10-01', rows: 12 });
    expect(days[1]).toEqual({ date: '2026-10-02', rows: 0 });
    expect(days[21]).toEqual({ date: '2026-10-22', rows: 4 });
  });

  it('gives every day of a past month, sums the keys of a same day', async () => {
    addKey('a', 'Alice');
    addKey('b', 'Bob');
    addUsage('a', '2026-09-30', 3);
    addUsage('b', '2026-09-30', 4);
    const { days } = await readKeyContributions(env.DB, '2026-09', NOW);
    expect(days).toHaveLength(30);
    expect(days[29]).toEqual({ date: '2026-09-30', rows: 7 });
  });

  it('answers an empty month with a total of 0 and the active keys at 0', async () => {
    addKey('a', 'Alice');
    const result = await readKeyContributions(env.DB, '2026-10', NOW);
    expect(result.total).toBe(0);
    expect(result.keys).toEqual([{ keyId: 'a', label: 'Alice', revoked: false, rows: 0 }]);
    expect(result.days.every((day) => day.rows === 0)).toBe(true);
  });

  it('lists the months having data, the most recent first, and always the current and the asked ones', async () => {
    addKey('a', 'Alice');
    addUsage('a', '2026-08-15', 1);
    addUsage('a', '2026-09-15', 1);
    const result = await readKeyContributions(env.DB, '2026-09', NOW);
    expect(result.months).toEqual(['2026-10', '2026-09', '2026-08']);
    expect(result.month).toBe('2026-09');
  });

  it('handles the change of year', async () => {
    addKey('a', 'Alice');
    addUsage('a', '2025-12-31', 8);
    addUsage('a', '2026-01-01', 9);
    const december = await readKeyContributions(env.DB, '2025-12', NOW);
    expect(december.total).toBe(8);
    expect(december.days).toHaveLength(31);
  });
});

describe('GET /api/sniffer/contributions', () => {
  it('refuses anyone but the owner', async () => {
    expect((await call('/api/sniffer/contributions', stranger)).status).toBe(403);
  });

  it('answers the current month by default, with nothing that identifies a key beyond its id and label', async () => {
    addKey('a', 'Alice');
    addUsage('a', '2026-10-21', 120);
    const response = await call('/api/sniffer/contributions');
    expect(response.status).toBe(200);
    const text = await response.text();
    const body = JSON.parse(text) as KeyContributions;
    expect(body.month).toBe('2026-10');
    expect(body.total).toBe(120);
    expect(body.keys).toEqual([{ keyId: 'a', label: 'Alice', revoked: false, rows: 120 }]);
    expect(text).not.toMatch(/hash|secret|key_hash|dcp_/i);
  });

  it('answers the month asked', async () => {
    addKey('a', 'Alice');
    addUsage('a', '2026-09-03', 50);
    const body = (await (await call('/api/sniffer/contributions?month=2026-09')).json()) as KeyContributions;
    expect(body).toMatchObject({ month: '2026-09', total: 50 });
  });

  it.each(['2026-13', 'abc', '2027-01'])('refuses the month %j with a message on the field', async (month) => {
    const response = await call(`/api/sniffer/contributions?month=${month}`);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Mois attendu sous la forme 2026-10.', field: 'month' });
  });
});
