import { isRecord, json, nowIso, readJson, unauthorized, type FmEnv } from './http';

// specs/028-site-started-sessions (contracts/fm-bot-commands.md): the requests of the site to the Discord
// bot, which can't be reached from outside. The bot fetches them every `POLL_AFTER_SECONDS`, runs them
// in order and acknowledges each one; an acknowledged request is never handed out again (FR-006, FR-007).

export const POLL_AFTER_SECONDS = 10;
const MAX_ERROR_LENGTH = 200;

export function isBotAuthorized(request: Request, env: FmEnv): boolean {
  const key = env.FM_BOT_API_KEY ?? '';
  return key !== '' && request.headers.get('Authorization') === `Bearer ${key}`;
}

type CommandRow = {
  id: string; type: 'open' | 'close' | 'create-channel' | 'archive-channel' | 'reopen-channel'; channel_id: string | null; channel_name: string | null;
  player_id: string | null; display_name: string | null; label: string | null; item_name: string | null; requested_name: string | null;
};

export async function listCommands(request: Request, env: FmEnv): Promise<Response> {
  if (!isBotAuthorized(request, env)) return unauthorized();
  // open / close: the session's owner and item; create-channel (specs/029): the requester and the item chosen;
  // archive-channel / reopen-channel (specs/033): the channel itself, named from `fm_channels`.
  const { results } = await env.DB.prepare(
    `SELECT c.id, c.type, c.channel_id, COALESCE(s.channel_name, ch.channel_name) AS channel_name, c.requested_name,
            COALESCE(s.owner_discord_user_id, c.requester_discord_user_id) AS player_id, p.display_name,
            i.label, i.item_name
     FROM fm_bot_commands c
     LEFT JOIN fm_sessions s ON s.id = c.session_id
     LEFT JOIN fm_players p ON p.discord_user_id = COALESCE(s.owner_discord_user_id, c.requester_discord_user_id)
     LEFT JOIN fm_channels ch ON ch.channel_id = c.channel_id
     LEFT JOIN fm_items i ON i.id = COALESCE(s.fm_item_id, ch.fm_item_id, c.fm_item_id)
     WHERE c.status = 'pending'
     ORDER BY c.created_at, c.rowid`,
  ).all<CommandRow>();
  const player = (row: CommandRow) => (row.player_id ? { id: row.player_id, displayName: row.display_name } : null);
  const item = (row: CommandRow) => (row.item_name ? { name: row.label ?? row.item_name } : null);
  return json({
    pollAfterSeconds: POLL_AFTER_SECONDS,
    commands: results.map((row) => {
      // The bot may be on several servers: the channel goes on the site's own (its players are members of it).
      if (row.type === 'create-channel') {
        return { id: row.id, type: row.type, guildId: env.DISCORD_GUILD_ID ?? null, name: row.requested_name, player: player(row), item: item(row) };
      }
      if (row.type === 'open') return { id: row.id, type: row.type, channelId: row.channel_id, channelName: row.channel_name, player: player(row), item: item(row) };
      if (row.type === 'reopen-channel') return { id: row.id, type: row.type, channelId: row.channel_id, channelName: row.channel_name, player: player(row) };
      return { id: row.id, type: row.type, channelId: row.channel_id, channelName: row.channel_name };
    }),
  });
}

export async function acknowledgeCommand(request: Request, env: FmEnv, commandId: string): Promise<Response> {
  if (!isBotAuthorized(request, env)) return unauthorized();
  const body = await readJson(request);
  const status = isRecord(body) ? body.status : undefined;
  if (status !== 'done' && status !== 'failed') return json({ error: 'status must be "done" or "failed"' }, 400);
  const error = status === 'failed' && isRecord(body) && typeof body.error === 'string' ? body.error.trim().slice(0, MAX_ERROR_LENGTH) || null : null;

  const command = await env.DB.prepare('SELECT id, type, session_id, status FROM fm_bot_commands WHERE id = ?')
    .bind(commandId).first<{ id: string; type: CommandRow['type']; session_id: string | null; status: string }>();
  // specs/029: a created channel's id, given back with a successful create-channel.
  const channelId = isRecord(body) && typeof body.channelId === 'string' && body.channelId ? body.channelId : null;
  if (!command) return json({ error: 'Not found' }, 404);
  // A repeated acknowledgement, or one for a request cancelled meanwhile, changes nothing.
  if (command.status !== 'pending') return json({ id: command.id, status: command.status });

  const at = nowIso();
  const statements = [
    env.DB.prepare('UPDATE fm_bot_commands SET status = ?, error = ?, acknowledged_at = ? WHERE id = ? AND status = \'pending\'').bind(status, error, at, commandId),
  ];
  if (command.type === 'create-channel' && channelId) {
    statements.push(env.DB.prepare('UPDATE fm_bot_commands SET result_channel_id = COALESCE(result_channel_id, ?) WHERE id = ?').bind(channelId, commandId));
  }
  if (command.type === 'open' && command.session_id) {
    statements.push(env.DB.prepare('UPDATE fm_sessions SET sync_status = ?, sync_error = ? WHERE id = ?')
      .bind(status === 'done' ? 'opened' : 'failed', error, command.session_id));
  }
  await env.DB.batch(statements);
  return json({ id: command.id, status });
}
