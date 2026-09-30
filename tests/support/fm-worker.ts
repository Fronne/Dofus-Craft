import { handleFm } from '../../worker/src/fm/router';
import { sha256Hex, type FmEnv } from '../../worker/src/fm/http';
import { createTestD1 } from './sqlite-d1';

// specs/025-rune-purchase-import: the Forgemagie routes over the in-memory SQLite database, with a bot
// key, Discord settings and helpers to log a player in and to send bot events.
export const BOT_KEY = 'bot-key';

export function createFmWorker() {
  const test = createTestD1();
  const env: FmEnv = {
    DB: test.d1,
    FM_BOT_API_KEY: BOT_KEY,
    DISCORD_CLIENT_ID: 'client-id',
    DISCORD_CLIENT_SECRET: 'client-secret',
    DISCORD_GUILD_ID: 'guild-1',
    SITE_URL: 'https://site.test',
  };

  async function call(method: string, path: string, options: { body?: unknown; token?: string; authorization?: string } = {}) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (options.token) headers.Authorization = `Bearer ${options.token}`;
    if (options.authorization !== undefined) headers.Authorization = options.authorization;
    const url = new URL(`https://api.test${path}`);
    const request = new Request(url, { method, headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
    return handleFm(request, url, env);
  }

  // A logged-in player, as the Discord callback would leave them.
  async function login(discordUserId: string, player: { displayName?: string; serverId?: string | null; isPrivate?: boolean } = {}) {
    test.sqlite.prepare(
      `INSERT INTO fm_players (discord_user_id, display_name, avatar_url, server_id, is_private, first_login_at, created_at)
       VALUES (?, ?, NULL, ?, ?, ?, ?)
       ON CONFLICT (discord_user_id) DO UPDATE SET server_id = excluded.server_id, is_private = excluded.is_private, first_login_at = excluded.first_login_at`,
    ).run(discordUserId, player.displayName ?? `Joueur ${discordUserId}`, player.serverId === undefined ? 'mikhal' : player.serverId,
      player.isPrivate ? 1 : 0, '2026-09-30T10:00:00.000Z', '2026-09-30T10:00:00.000Z');
    const token = `token-${discordUserId}`;
    test.sqlite.prepare('INSERT OR REPLACE INTO fm_auth_sessions (token_hash, discord_user_id, expires_at) VALUES (?, ?, ?)')
      .run(await sha256Hex(token), discordUserId, new Date(Date.now() + 86_400_000).toISOString());
    return token;
  }

  let eventCounter = 0;
  const botEvent = (type: string, fields: Record<string, unknown> = {}) => call('POST', '/fm/bot/events', {
    authorization: `Bearer ${BOT_KEY}`,
    body: {
      type,
      eventId: `event-${(eventCounter += 1)}`,
      channelId: 'channel-1',
      channelName: 'fm-coiffe',
      occurredAt: new Date(Date.UTC(2026, 8, 30, 18, 0, eventCounter)).toISOString(),
      ...fields,
    },
  });

  // The author keeps the name they already have (as Discord would send it), `Joueur <id>` otherwise.
  const capture = (authorId: string, spentKamas: number, lines: { name: string; qty: number; price: number }[], fields: Record<string, unknown> = {}) => {
    const known = test.sqlite.prepare('SELECT display_name FROM fm_players WHERE discord_user_id = ?').get(authorId) as { display_name: string } | undefined;
    const author = { id: authorId, displayName: known?.display_name ?? `Joueur ${authorId}`, avatarUrl: null };
    return botEvent('capture', { author, spentKamas, lines, ...fields });
  };

  const query = <T>(sql: string, ...params: (string | number | null)[]) => test.sqlite.prepare(sql).all(...params) as T[];

  return { ...test, env, call, login, botEvent, capture, query };
}

export const doAirLine = { name: 'Rune Do Air', qty: 10, price: 15868 };
