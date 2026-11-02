import { json, type FmDb } from '../http';
import { itemSummaries, STALE_AFTER_MS } from '../reads';
import { itemViews } from './items';
import { findSeance, summarize } from './list';
import { notFound, type CommandRow, type CorrectedItemRow, type LineRow, type TotalRow } from './types';

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
