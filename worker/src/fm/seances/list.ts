import { json, type FmDb } from '../http';
import { placeholders } from '../reads';
import type { ChannelRow, FoundSeance, ItemView, ItemViewRow, SessionRow, TotalRow } from './types';

const MAX_SEANCES = 200;

export const SESSION_SELECT = 'SELECT id, channel_id, channel_name, status, opened_at, closed_at, fm_item_id, origin, sync_status, sync_error FROM fm_sessions';

const latest = (...dates: (string | null | undefined)[]) => dates.filter((date): date is string => Boolean(date)).sort().at(-1)!;

// Running: a session is open in it; paused: none is; archived: its channel no longer is active in Discord.
export function summarize(channelId: string, channel: ChannelRow | undefined, sessions: SessionRow[], totals: Map<string, TotalRow>) {
  const ordered = [...sessions].sort((a, b) => (a.opened_at < b.opened_at ? 1 : a.opened_at > b.opened_at ? -1 : 0));
  const discord = channel?.status ?? ('ordinary' as const);
  const state = discord !== 'active' ? ('archived' as const) : ordered.some((session) => session.status === 'open') ? ('running' as const) : ('paused' as const);
  return {
    id: channelId,
    name: channel?.channel_name ?? ordered[0].channel_name,
    state,
    discord,
    // The channel's item; an ordinary séance carries it on its sessions (the most recent one that has one).
    fmItemId: channel ? channel.fm_item_id : ordered.find((session) => session.fm_item_id)?.fm_item_id ?? null,
    totalKamas: ordered.reduce((total, session) => total + (totals.get(session.id)?.total_kamas ?? 0), 0),
    sessionCount: ordered.length,
    captureCount: ordered.reduce((count, session) => count + (totals.get(session.id)?.capture_count ?? 0), 0),
    createdAt: channel?.created_at ?? ordered.at(-1)!.opened_at,
    lastActivityAt: latest(
      channel?.created_at,
      ...ordered.flatMap((session) => [session.opened_at, session.closed_at, totals.get(session.id)?.last_capture_at]),
    ),
    sessions: ordered,
  };
}

const STATE_ORDER = { running: 0, paused: 1, archived: 2 };

// The séances of several players at once (the players' list reads everyone's): running first, then
// paused, then archived, the most recently active first.
export async function seancesOf(db: FmDb, ownerIds: string[]) {
  const byOwner = new Map(ownerIds.map((ownerId) => [ownerId, [] as (ReturnType<typeof summarize> & { fmItem: ItemView | null })[]]));
  if (ownerIds.length === 0) return byOwner;
  const owners = placeholders(ownerIds.length);
  const { results: channels } = await db.prepare(
    `SELECT channel_id, channel_name, status, fm_item_id, created_at, owner_discord_user_id FROM fm_channels WHERE owner_discord_user_id IN (${owners})`,
  ).bind(...ownerIds).all<ChannelRow & { owner_discord_user_id: string }>();
  const { results: sessions } = await db.prepare(
    `SELECT id, channel_id, channel_name, status, opened_at, closed_at, fm_item_id, origin, sync_status, sync_error, owner_discord_user_id
     FROM fm_sessions WHERE owner_discord_user_id IN (${owners})`,
  ).bind(...ownerIds).all<SessionRow & { owner_discord_user_id: string }>();
  const { results: totalRows } = await db.prepare(
    `SELECT c.session_id, SUM(c.spent_kamas) AS total_kamas, COUNT(*) AS capture_count, MAX(c.created_at) AS last_capture_at
     FROM fm_captures c JOIN fm_sessions s ON s.id = c.session_id WHERE s.owner_discord_user_id IN (${owners}) GROUP BY c.session_id`,
  ).bind(...ownerIds).all<TotalRow>();
  const { results: itemRows } = await db.prepare(
    `SELECT id, label, item_name, item_image_url, owner_discord_user_id FROM fm_items WHERE owner_discord_user_id IN (${owners})`,
  ).bind(...ownerIds).all<ItemViewRow & { owner_discord_user_id: string }>();
  const totals = new Map(totalRows.map((row) => [row.session_id, row]));
  for (const ownerId of ownerIds) {
    const byChannel = new Map<string, SessionRow[]>();
    for (const session of sessions) {
      if (session.owner_discord_user_id === ownerId) byChannel.set(session.channel_id, [...(byChannel.get(session.channel_id) ?? []), session]);
    }
    const mine = new Map(channels.filter((channel) => channel.owner_discord_user_id === ownerId).map((channel) => [channel.channel_id, channel]));
    const items = new Map(itemRows.filter((row) => row.owner_discord_user_id === ownerId).map((row) => [row.id, { id: row.id, name: row.label ?? row.item_name, itemName: row.item_name, label: row.label, imageUrl: row.item_image_url }]));
    byOwner.set(ownerId, [...new Set([...mine.keys(), ...byChannel.keys()])]
      .map((channelId) => summarize(channelId, mine.get(channelId), byChannel.get(channelId) ?? [], totals))
      .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || (a.lastActivityAt < b.lastActivityAt ? 1 : a.lastActivityAt > b.lastActivityAt ? -1 : 0))
      .slice(0, MAX_SEANCES)
      .map((seance) => ({ ...seance, fmItem: seance.fmItemId ? items.get(seance.fmItemId) ?? null : null })));
  }
  return byOwner;
}

export async function listSeances(db: FmDb, viewerId: string): Promise<Response> {
  const seances = (await seancesOf(db, [viewerId])).get(viewerId) ?? [];
  return json({
    seances: seances.map((seance) => ({
      id: seance.id,
      name: seance.name,
      state: seance.state,
      discord: seance.discord,
      fmItem: seance.fmItem,
      totalKamas: seance.totalKamas,
      sessionCount: seance.sessionCount,
      captureCount: seance.captureCount,
      createdAt: seance.createdAt,
      lastActivityAt: seance.lastActivityAt,
    })),
  });
}

// Another player's channel or sessions are not found, like missing ones.
export async function findSeance(db: FmDb, viewerId: string, channelId: string): Promise<FoundSeance | undefined> {
  const channel = await db.prepare(
    'SELECT channel_id, channel_name, status, fm_item_id, created_at FROM fm_channels WHERE channel_id = ? AND owner_discord_user_id = ?',
  ).bind(channelId, viewerId).first<ChannelRow>();
  const { results: sessions } = await db.prepare(`${SESSION_SELECT} WHERE channel_id = ? AND owner_discord_user_id = ?`).bind(channelId, viewerId).all<SessionRow>();
  if (!channel && sessions.length === 0) return undefined;
  return { channel: channel ?? undefined, sessions };
}
