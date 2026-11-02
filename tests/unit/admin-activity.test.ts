import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleApi, type Env } from '../../admin-worker/src/index';
import { readActivity, type Activity } from '../../admin-worker/src/activity';
import { createTestD1 } from '../support/sqlite-d1';

// specs/070-admin-dashboard-graphiques (data-model.md « Activité », contracts/admin-dashboard-api.md).
const NOW = new Date('2026-10-22T14:37:05.000Z');
const owner = vi.fn().mockResolvedValue({ email: 'owner@example.com' });
const stranger = vi.fn().mockResolvedValue({ email: 'someone@else.com' });

let test: ReturnType<typeof createTestD1>;
let env: Env;

function addPrice(createdAt: string, origin: string, resourceId = 'resource-secret') {
  test.sqlite.prepare(
    `INSERT INTO community_price_contributions (id, resource_id, server_id, amount_kamas, device_id, created_at, origin)
     VALUES (?, ?, 'mikhal', 100, 'device-secret', ?, ?)`,
  ).run(crypto.randomUUID(), resourceId, createdAt, origin);
}

function addVisit(deviceId: string, day: string) {
  test.sqlite.prepare('INSERT INTO app_visits (device_id, day) VALUES (?, ?)').run(deviceId, day);
}

function call(verify = owner) {
  const request = new Request('https://dofus-craft-admin.example.workers.dev/api/activity', { headers: { 'Cf-Access-Jwt-Assertion': 'jwt' } });
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

describe('readActivity', () => {
  it('gives the last 30 UTC days, today included, every day at 0 when nothing happened', async () => {
    const activity = await readActivity(env.DB, NOW);
    expect(activity.days).toHaveLength(30);
    expect(activity.days[0].date).toBe('2026-09-23');
    expect(activity.days[29].date).toBe('2026-10-22');
    expect(activity.days.every((day) => day.visitors === 0 && Object.values(day.prices).every((count) => count === 0))).toBe(true);
    expect(activity.pricesTotal).toBe(0);
    expect(activity.visitorsToday).toBe(0);
  });

  it('counts the prices of each day by origin', async () => {
    addPrice('2026-10-21T08:00:00.000Z', 'sniffer');
    addPrice('2026-10-21T09:00:00.000Z', 'sniffer');
    addPrice('2026-10-21T23:59:59.000Z', 'manual');
    addPrice('2026-10-22T01:00:00.000Z', 'bot');
    addPrice('2026-10-22T02:00:00.000Z', 'capture');
    const { days, pricesTotal } = await readActivity(env.DB, NOW);
    expect(days[28].prices).toEqual({ manual: 1, capture: 0, bot: 0, sniffer: 2 });
    expect(days[29].prices).toEqual({ manual: 0, capture: 1, bot: 1, sniffer: 0 });
    expect(pricesTotal).toBe(5);
  });

  it('counts a visitor once per day, one row per device, and gives today\'s visitors', async () => {
    addVisit('a', '2026-10-22');
    addVisit('b', '2026-10-22');
    addVisit('a', '2026-10-21');
    const { days, visitorsToday } = await readActivity(env.DB, NOW);
    expect(days[29].visitors).toBe(2);
    expect(days[28].visitors).toBe(1);
    expect(visitorsToday).toBe(2);
  });

  it('leaves out what is older than the 30 days, and the day before the window', async () => {
    addPrice('2026-09-22T23:59:00.000Z', 'manual');
    addVisit('a', '2026-09-22');
    addPrice('2026-09-23T00:00:00.000Z', 'manual');
    addVisit('b', '2026-09-23');
    const { days, pricesTotal } = await readActivity(env.DB, NOW);
    expect(pricesTotal).toBe(1);
    expect(days[0]).toMatchObject({ date: '2026-09-23', visitors: 1 });
  });

  it('ignores an origin it does not know instead of guessing', async () => {
    test.sqlite.exec('DROP TABLE community_price_contributions');
    test.sqlite.exec(`CREATE TABLE community_price_contributions (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, origin TEXT NOT NULL)`);
    test.sqlite.prepare('INSERT INTO community_price_contributions VALUES (?, ?, ?)').run('1', '2026-10-22T01:00:00.000Z', 'import');
    test.sqlite.prepare('INSERT INTO community_price_contributions VALUES (?, ?, ?)').run('2', '2026-10-22T01:00:00.000Z', 'bot');
    const { pricesTotal } = await readActivity(env.DB, NOW);
    expect(pricesTotal).toBe(1);
  });

  it('only reads the last 30 days, through the dashboard indexes', () => {
    const plans = (sql: string, ...args: string[]) =>
      (test.sqlite.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...args) as { detail: string }[]).map((row) => row.detail).join(' | ');
    expect(plans('SELECT substr(created_at, 1, 10) AS day, origin, COUNT(*) FROM community_price_contributions WHERE created_at >= ? GROUP BY day, origin', '2026-09-23'))
      .toContain('idx_community_price_contributions_created_at');
    expect(plans('SELECT day, COUNT(*) FROM app_visits WHERE day >= ? GROUP BY day', '2026-09-23')).toContain('idx_app_visits_day');
  });
});

describe('GET /api/activity', () => {
  it('refuses anyone but the owner', async () => {
    expect((await call(stranger)).status).toBe(403);
  });

  it('answers totals only: no device, resource or key identifier', async () => {
    addPrice('2026-10-22T01:00:00.000Z', 'sniffer');
    addVisit('device-secret', '2026-10-22');
    const response = await call();
    expect(response.status).toBe(200);
    const text = await response.text();
    const body = JSON.parse(text) as Activity;
    expect(body.pricesTotal).toBe(1);
    expect(body.visitorsToday).toBe(1);
    expect(text).not.toMatch(/device|resource|secret|deviceId|key/i);
  });
});

// specs/082-auteur-prix-communautaires: who visited today.
describe('readActivity — the visitors of the day', () => {
  const visit = (device: string, day: string, player: string | null) =>
    test.sqlite.prepare('INSERT INTO app_visits (device_id, day, discord_user_id) VALUES (?, ?, ?)').run(device, day, player);
  const player = (id: string, name: string, isPrivate = 0) =>
    test.sqlite.prepare('INSERT INTO fm_players (discord_user_id, display_name, is_private) VALUES (?, ?, ?)').run(id, name, isPrivate);

  it('names the logged-in players, counts the private profiles and the anonymous devices', async () => {
    player('1', 'Cyril'); player('2', 'Zoe'); player('3', 'Secret', 1);
    visit('a', '2026-10-22', '1'); visit('a2', '2026-10-22', '1'); visit('b', '2026-10-22', '2'); visit('c', '2026-10-22', '3');
    visit('d', '2026-10-22', null); visit('e', '2026-10-22', null);
    visit('old', '2026-10-21', '2');
    const activity = await readActivity(env.DB, NOW);
    expect(activity.visitorsToday).toBe(6);
    expect(activity.todayPlayers).toEqual({ names: ['Cyril', 'Zoe'], private: 1, anonymous: 2 });
    expect(JSON.stringify(activity)).not.toContain('Secret');
  });

  it('is empty when nobody visited', async () => {
    expect((await readActivity(env.DB, NOW)).todayPlayers).toEqual({ names: [], private: 0, anonymous: 0 });
  });
});
