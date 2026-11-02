import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../../worker/src/fm/http';
import { createFmWorker } from '../support/fm-worker';

// specs/075-connexion-discord-site (US4, FR-005, research R2): the group's data is for the members of its
// Discord server; the profile is for any logged-in player.
const GROUP_ROUTES: [string, string][] = [
  ['GET', '/fm/seances'],
  ['GET', '/fm/sessions'],
  ['GET', '/fm/players'],
  ['GET', '/fm/channels'],
  ['POST', '/fm/imports'],
  ['POST', '/fm/items'],
  ['PUT', '/fm/captures/x/lines'],
];

describe('the routes of the group\'s data', () => {
  it('answer 403 not-member to a player who is not a member of the group\'s server', async () => {
    const fm = createFmWorker();
    const token = await fm.login('42', { isMember: false });
    for (const [method, path] of GROUP_ROUTES) {
      const response = await fm.call(method, path, { token, body: method === 'GET' ? undefined : {} });
      expect(response.status, `${method} ${path}`).toBe(403);
      expect(await response.json()).toEqual({ error: 'not-member' });
    }
  });

  it('are open to a member', async () => {
    const fm = createFmWorker();
    const token = await fm.login('42');
    expect((await fm.call('GET', '/fm/seances', { token })).status).toBe(200);
    expect((await fm.call('GET', '/fm/players', { token })).status).toBe(200);
  });

  it('still answer 401 without a session or with an expired one', async () => {
    const fm = createFmWorker();
    expect((await fm.call('GET', '/fm/seances')).status).toBe(401);
    fm.sqlite.prepare("INSERT INTO fm_players (discord_user_id, display_name) VALUES ('42', 'Cyril')").run();
    fm.sqlite.prepare("INSERT INTO fm_auth_sessions (token_hash, discord_user_id, expires_at, is_member) VALUES (?, '42', '2020-01-01T00:00:00.000Z', 0)")
      .run(await sha256Hex('old'));
    expect((await fm.call('GET', '/fm/seances', { token: 'old' })).status).toBe(401);
  });

  it('keep a session made before the migration (is_member left to its default) open', async () => {
    const fm = createFmWorker();
    fm.sqlite.prepare("INSERT INTO fm_players (discord_user_id, display_name) VALUES ('42', 'Cyril')").run();
    fm.sqlite.prepare("INSERT INTO fm_auth_sessions (token_hash, discord_user_id, expires_at) VALUES (?, '42', ?)")
      .run(await sha256Hex('legacy'), new Date(Date.now() + 86_400_000).toISOString());
    expect((await fm.call('GET', '/fm/seances', { token: 'legacy' })).status).toBe(200);
  });
});

describe('the profile and the logout', () => {
  it('stay open to a player who is not a member', async () => {
    const fm = createFmWorker();
    const token = await fm.login('42', { isMember: false });
    expect((await fm.call('GET', '/fm/me', { token })).status).toBe(200);
    expect((await fm.call('PATCH', '/fm/me', { token, body: { isPrivate: true } })).status).toBe(200);
    expect((await fm.call('POST', '/fm/auth/logout', { token })).status).toBe(204);
  });

  it('let a player who is not a member delete their profile', async () => {
    const fm = createFmWorker();
    const token = await fm.login('42', { isMember: false });
    expect((await fm.call('DELETE', '/fm/me', { token })).status).toBe(204);
    expect(fm.query('SELECT * FROM fm_players')).toEqual([]);
  });
});
