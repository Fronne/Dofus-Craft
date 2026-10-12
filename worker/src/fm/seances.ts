import { isRecord, json, nowIso, readJson, type FmDb, type FmStatement } from './http';
import { MAX_ACTIVE_CHANNELS } from './channels';
import { insertItemStatement, parseNewItem } from './items';
import { itemSummaries, placeholders, STALE_AFTER_MS, type ItemRow } from './reads';

// specs/045-restore-production-worker (contracts/api.md, « Séances de FM »): a séance de FM is a channel
// and every session the viewer held in it. A channel of the viewer's own (`fm_channels`) is `active` or
// `archived` in Discord; a séance held in another channel is `ordinary` — it exists by its sessions only.

const MAX_SEANCES = 200;

const notFound = () => json({ error: 'Not found' }, 404);

type ChannelRow = { channel_id: string; channel_name: string; status: 'active' | 'archived' | 'deleted'; fm_item_id: string | null; created_at: string };
type SessionRow = {
  id: string; channel_id: string; channel_name: string; status: 'open' | 'closed'; opened_at: string; closed_at: string | null;
  fm_item_id: string | null; origin: 'discord' | 'site'; sync_status: 'pending' | 'opened' | 'failed' | 'cancelled' | null; sync_error: string | null;
};
type TotalRow = { session_id: string; total_kamas: number; capture_count: number; last_capture_at: string };
type ItemView = { id: string; name: string; itemName: string; label: string | null; imageUrl: string | null };
type ItemViewRow = { id: string; label: string | null; item_name: string; item_image_url: string | null };

const SESSION_SELECT = 'SELECT id, channel_id, channel_name, status, opened_at, closed_at, fm_item_id, origin, sync_status, sync_error FROM fm_sessions';

const latest = (...dates: (string | null | undefined)[]) => dates.filter((date): date is string => Boolean(date)).sort().at(-1)!;

async function itemViews(db: FmDb, viewerId: string, ids: string[]): Promise<Map<string, ItemView>> {
  const views = new Map<string, ItemView>();
  if (ids.length === 0) return views;
  const { results } = await db.prepare(
    `SELECT id, label, item_name, item_image_url FROM fm_items WHERE owner_discord_user_id = ? AND id IN (${placeholders(ids.length)})`,
  ).bind(viewerId, ...ids).all<ItemViewRow>();
  for (const row of results) {
    views.set(row.id, { id: row.id, name: row.label ?? row.item_name, itemName: row.item_name, label: row.label, imageUrl: row.item_image_url });
  }
  return views;
}

// Running: a session is open in it; paused: none is; archived: its channel no longer is active in Discord.
function summarize(channelId: string, channel: ChannelRow | undefined, sessions: SessionRow[], totals: Map<string, TotalRow>) {
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

type FoundSeance = { channel: ChannelRow | undefined; sessions: SessionRow[] };

// Another player's channel or sessions are not found, like missing ones.
async function findSeance(db: FmDb, viewerId: string, channelId: string): Promise<FoundSeance | undefined> {
  const channel = await db.prepare(
    'SELECT channel_id, channel_name, status, fm_item_id, created_at FROM fm_channels WHERE channel_id = ? AND owner_discord_user_id = ?',
  ).bind(channelId, viewerId).first<ChannelRow>();
  const { results: sessions } = await db.prepare(`${SESSION_SELECT} WHERE channel_id = ? AND owner_discord_user_id = ?`).bind(channelId, viewerId).all<SessionRow>();
  if (!channel && sessions.length === 0) return undefined;
  return { channel: channel ?? undefined, sessions };
}

type CorrectedItemRow = ItemRow & { corrected: number };
type LineRow = {
  id: string; capture_id: string; item_name: string; quantity: number; total_kamas: number; unit_price_kamas: number;
  original_quantity: number | null; original_total_kamas: number | null; corrected_at: string | null; price_status: string;
  original_item_name: string | null; counted: number;
};
type CommandRow = { type: string; session_id: string | null; status: string; error: string | null; created_at: string };

const ITEM_COLUMNS = `l.item_name, MAX(l.item_id) AS item_id, SUM(l.quantity) AS quantity, SUM(l.total_kamas) AS total_kamas,
  MAX(l.corrected_at IS NOT NULL) AS corrected`;

const summaries = (rows: CorrectedItemRow[]) => itemSummaries(rows).map((summary, index) => ({ ...summary, corrected: rows[index].corrected === 1 }));

// The names an item was read under in a capture, when it was recovered from a misread one (specs/038).
const readNames = (lines: LineRow[], captureId: string, itemName: string) => [...new Set(
  lines.filter((line) => line.capture_id === captureId && line.item_name === itemName).flatMap((line) => line.original_item_name ?? []),
)];

export async function seanceDetail(db: FmDb, viewerId: string, channelId: string) {
  const found = await findSeance(db, viewerId, channelId);
  if (!found) return undefined;
  const { results: captures } = await db.prepare(
    `SELECT c.id, c.session_id, c.created_at, c.origin, c.spent_kamas FROM fm_captures c JOIN fm_sessions s ON s.id = c.session_id
     WHERE s.channel_id = ? AND s.owner_discord_user_id = ? ORDER BY c.created_at, c.id`,
  ).bind(channelId, viewerId).all<{ id: string; session_id: string; created_at: string; origin: 'bot' | 'capture'; spent_kamas: number }>();
  const { results: captureItems } = await db.prepare(
    `SELECT l.capture_id, ${ITEM_COLUMNS}
     FROM fm_purchase_lines l JOIN fm_captures c ON c.id = l.capture_id JOIN fm_sessions s ON s.id = c.session_id
     WHERE s.channel_id = ? AND s.owner_discord_user_id = ? AND l.counted = 1 GROUP BY l.capture_id, l.item_name ORDER BY total_kamas DESC, l.item_name`,
  ).bind(channelId, viewerId).all<CorrectedItemRow & { capture_id: string }>();
  const { results: items } = await db.prepare(
    `SELECT ${ITEM_COLUMNS}
     FROM fm_purchase_lines l JOIN fm_captures c ON c.id = l.capture_id JOIN fm_sessions s ON s.id = c.session_id
     WHERE s.channel_id = ? AND s.owner_discord_user_id = ? AND l.counted = 1 GROUP BY l.item_name ORDER BY total_kamas DESC, l.item_name`,
  ).bind(channelId, viewerId).all<CorrectedItemRow>();
  const { results: everyLine } = await db.prepare(
    `SELECT l.id, l.capture_id, l.item_name, l.quantity, l.total_kamas, l.unit_price_kamas, l.original_quantity, l.original_total_kamas,
            l.corrected_at, l.price_status, l.original_item_name, l.counted
     FROM fm_purchase_lines l JOIN fm_captures c ON c.id = l.capture_id JOIN fm_sessions s ON s.id = c.session_id
     WHERE s.channel_id = ? AND s.owner_discord_user_id = ? ORDER BY l.capture_id, l.position`,
  ).bind(channelId, viewerId).all<LineRow>();
  // specs/044-fm-runes-only: only the runes count; the other lines are listed apart, as ignored.
  const lines = everyLine.filter((line) => line.counted === 1);
  const uncounted = everyLine.filter((line) => line.counted !== 1);
  const { results: commands } = await db.prepare(
    'SELECT type, session_id, status, error, created_at FROM fm_bot_commands WHERE channel_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 20',
  ).bind(channelId).all<CommandRow>();
  const totals = new Map<string, TotalRow>();
  for (const capture of captures) {
    const total = totals.get(capture.session_id) ?? { session_id: capture.session_id, total_kamas: 0, capture_count: 0, last_capture_at: capture.created_at };
    totals.set(capture.session_id, { ...total, total_kamas: total.total_kamas + capture.spent_kamas, capture_count: total.capture_count + 1, last_capture_at: capture.created_at });
  }
  const { sessions, fmItemId, ...seance } = summarize(channelId, found.channel, found.sessions, totals);
  const item = fmItemId ? (await itemViews(db, viewerId, [fmItemId])).get(fmItemId) ?? null : null;
  // A request the bot hasn't acknowledged after 10 minutes reads as « not transmitted » (specs/028 FR-011).
  const staleBefore = new Date(Date.now() - STALE_AFTER_MS).toISOString();
  const isStale = (command: CommandRow) => command.status === 'pending' && command.created_at < staleBefore;
  const staleOpens = new Set(commands.filter((command) => command.type === 'open' && isStale(command)).map((command) => command.session_id));
  const last = commands.find((command) => command.type === 'archive-channel' || command.type === 'reopen-channel');
  const request = last && (last.status === 'pending' || last.status === 'failed')
    ? { type: last.type === 'archive-channel' ? 'archive' : 'reopen', status: isStale(last) ? 'stale' : last.status, error: last.error }
    : null;
  return {
    ...seance,
    fmItem: item,
    quantity: items.reduce((total, row) => total + row.quantity, 0),
    items: summaries(items),
    sessions: sessions.map((session) => ({
      id: session.id,
      status: session.status,
      openedAt: session.opened_at,
      closedAt: session.closed_at,
      totalKamas: totals.get(session.id)?.total_kamas ?? 0,
      origin: session.origin,
      sync: session.origin === 'site' && session.sync_status ? { status: staleOpens.has(session.id) ? 'stale' : session.sync_status, error: session.sync_error } : null,
      canStop: session.status === 'open',
      captures: captures.filter((capture) => capture.session_id === session.id).map((capture) => ({
        id: capture.id,
        createdAt: capture.created_at,
        origin: capture.origin,
        spentKamas: capture.spent_kamas,
        items: summaries(captureItems.filter((row) => row.capture_id === capture.id)).map((item) => ({ ...item, readNames: readNames(lines, capture.id, item.itemName) })),
        corrected: lines.some((line) => line.capture_id === capture.id && line.corrected_at !== null),
        lines: lines.filter((line) => line.capture_id === capture.id).map((line) => ({
          id: line.id,
          itemName: line.item_name,
          quantity: line.quantity,
          totalKamas: line.total_kamas,
          unitPriceKamas: line.unit_price_kamas,
          originalQuantity: line.original_quantity ?? line.quantity,
          originalTotalKamas: line.original_total_kamas ?? line.total_kamas,
          corrected: line.corrected_at !== null,
          priceStatus: line.price_status,
        })),
        ignored: uncounted.filter((line) => line.capture_id === capture.id).map((line) => ({ itemName: line.item_name, quantity: line.quantity, totalKamas: line.total_kamas })),
      })),
    })),
    request,
    canResume: seance.state === 'paused',
    canArchive: seance.discord === 'active',
    canReopen: seance.discord === 'archived',
  };
}

export async function readSeance(db: FmDb, viewerId: string, channelId: string): Promise<Response> {
  const detail = await seanceDetail(db, viewerId, channelId);
  return detail ? json(detail) : notFound();
}

const cancelPending = (db: FmDb, channelId: string, types: string[], at: string): FmStatement =>
  db.prepare(
    `UPDATE fm_bot_commands SET status = 'cancelled', acknowledged_at = ? WHERE channel_id = ? AND status = 'pending' AND type IN (${placeholders(types.length)})`,
  ).bind(at, channelId, ...types);

// The séance is archived on the site at once (its open session closes); the bot archives the channel.
export async function archiveSeance(db: FmDb, viewerId: string, channelId: string): Promise<Response> {
  const found = await findSeance(db, viewerId, channelId);
  if (!found) return notFound();
  if (found.channel?.status !== 'active') return json({ error: 'not-active' }, 409);
  const at = nowIso();
  await db.batch([
    cancelPending(db, channelId, ['open', 'close', 'reopen-channel'], at),
    db.prepare("UPDATE fm_sessions SET sync_status = 'cancelled' WHERE channel_id = ? AND status = 'open' AND sync_status = 'pending'").bind(channelId),
    db.prepare("UPDATE fm_sessions SET status = 'closed', closed_at = ? WHERE channel_id = ? AND status = 'open'").bind(at, channelId),
    db.prepare("UPDATE fm_channels SET status = 'archived', archived_at = ? WHERE channel_id = ?").bind(at, channelId),
    db.prepare(
      `INSERT INTO fm_bot_commands (id, type, channel_id, status, created_at, requester_discord_user_id) VALUES (?, 'archive-channel', ?, 'pending', ?, ?)`,
    ).bind(crypto.randomUUID(), channelId, at, viewerId),
  ]);
  return json(await seanceDetail(db, viewerId, channelId));
}

// Reopening counts in the limit of active channels, and starts a new session in the channel.
export async function reopenSeance(db: FmDb, viewerId: string, channelId: string): Promise<Response> {
  const found = await findSeance(db, viewerId, channelId);
  if (!found) return notFound();
  if (found.channel?.status !== 'archived') return json({ error: 'not-archived' }, 409);
  const used = await db.prepare(
    `SELECT (SELECT COUNT(*) FROM fm_channels WHERE owner_discord_user_id = ? AND status = 'active')
          + (SELECT COUNT(*) FROM fm_bot_commands WHERE requester_discord_user_id = ? AND type = 'create-channel' AND status = 'pending') AS n`,
  ).bind(viewerId, viewerId).first<{ n: number }>();
  if ((used?.n ?? 0) >= MAX_ACTIVE_CHANNELS) return json({ error: 'channel-limit' }, 409);
  const at = nowIso();
  const sessionId = crypto.randomUUID();
  const command = (type: 'reopen-channel' | 'open', session: string | null) => db.prepare(
    `INSERT INTO fm_bot_commands (id, type, session_id, channel_id, status, created_at, requester_discord_user_id) VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
  ).bind(crypto.randomUUID(), type, session, channelId, at, viewerId);
  await db.batch([
    cancelPending(db, channelId, ['archive-channel'], at),
    db.prepare("UPDATE fm_channels SET status = 'active', archived_at = NULL WHERE channel_id = ?").bind(channelId),
    db.prepare(
      `INSERT INTO fm_sessions (id, channel_id, channel_name, status, opened_at, owner_discord_user_id, origin, sync_status)
       VALUES (?, ?, ?, 'open', ?, ?, 'site', 'pending')`,
    ).bind(sessionId, channelId, found.channel.channel_name, at, viewerId),
    // In this order: the bot reopens the channel, then opens the session in it.
    command('reopen-channel', null),
    command('open', sessionId),
  ]);
  return json(await seanceDetail(db, viewerId, channelId));
}

// The item is the channel's when the séance has one of the viewer's own, else every session's.
function itemStatements(db: FmDb, viewerId: string, channelId: string, seance: FoundSeance, fmItemId: string | null): FmStatement[] {
  return seance.channel
    ? [
      db.prepare('UPDATE fm_channels SET fm_item_id = ? WHERE channel_id = ?').bind(fmItemId, channelId),
      db.prepare('UPDATE fm_sessions SET fm_item_id = NULL WHERE channel_id = ?').bind(channelId),
    ]
    : [db.prepare('UPDATE fm_sessions SET fm_item_id = ? WHERE channel_id = ? AND owner_discord_user_id = ?').bind(fmItemId, channelId, viewerId)];
}

export async function setSeanceItem(request: Request, db: FmDb, viewerId: string, channelId: string): Promise<Response> {
  const body = await readJson(request);
  const fmItemId = isRecord(body) && typeof body.fmItemId === 'string' ? body.fmItemId : undefined;
  const newItem = isRecord(body) && fmItemId === undefined ? parseNewItem(body.item) : undefined;
  if (!fmItemId && !newItem) return json({ error: 'fmItemId, or item (itemId, itemName and imageUrl as for a new item), is required' }, 400);
  const found = await findSeance(db, viewerId, channelId);
  if (!found) return notFound();
  if (fmItemId && !(await db.prepare('SELECT 1 AS mine FROM fm_items WHERE id = ? AND owner_discord_user_id = ?').bind(fmItemId, viewerId).first())) return notFound();
  const targetId = fmItemId ?? crypto.randomUUID();
  await db.batch([
    ...(newItem ? [insertItemStatement(db, targetId, viewerId, newItem)] : []),
    ...itemStatements(db, viewerId, channelId, found, targetId),
  ]);
  return json(await seanceDetail(db, viewerId, channelId));
}

export async function removeSeanceItem(db: FmDb, viewerId: string, channelId: string): Promise<Response> {
  const found = await findSeance(db, viewerId, channelId);
  if (!found) return notFound();
  await db.batch(itemStatements(db, viewerId, channelId, found, null));
  return json(await seanceDetail(db, viewerId, channelId));
}
