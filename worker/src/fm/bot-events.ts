import { isRecord, json, nowIso, readJson, unauthorized, upsertPlayerStatement, type FmDb, type FmEnv, type FmStatement } from './http';
import {
  clearCachedReadsIfPriced, isItemName, isKamasInteger, MAX_LINES, purchaseLineStatements, resolveBotLine,
  unitPriceKamas, type PurchaseLineInput, type ResolvedLine,
} from './purchases';

// specs/025-rune-purchase-import (contracts/fm-bot-api.md, research R4): POST /fm/bot/events. The bot
// sends one event per command or processed message. Like the bot, one open session per channel.

const EVENT_TYPES = ['session-start', 'capture', 'session-reset', 'session-stop'] as const;
type EventType = (typeof EVENT_TYPES)[number];

type CommonEvent = { type: EventType; eventId: string; channelId: string; channelName: string; occurredAt: string };
type CaptureEvent = CommonEvent & {
  author: { id: string; displayName: string; avatarUrl: string | null };
  spentKamas: number;
  lines: unknown[];
};

type LineAnswer = { index: number; name: string; unitPriceKamas: number | null; priceStatus: ResolvedLine['priceStatus'] | 'invalid' };
type EventAnswer = { status: 'ok' | 'ignored'; reason?: 'session-closed'; sessionId?: string; duplicate: boolean; lines?: LineAnswer[] };
type Author = { id: string; displayName: string; avatarUrl: string | null };

const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

function parseCommon(body: unknown): CommonEvent | undefined {
  if (!isRecord(body)) return undefined;
  const { type, eventId, channelId, channelName, occurredAt } = body;
  if (!EVENT_TYPES.includes(type as EventType) || !nonEmpty(eventId) || !nonEmpty(channelId) || !nonEmpty(channelName) || !nonEmpty(occurredAt)) return undefined;
  const date = new Date(occurredAt);
  if (Number.isNaN(date.getTime())) return undefined;
  return { type: type as EventType, eventId, channelId, channelName, occurredAt: date.toISOString() };
}

function parseAuthor(author: unknown): Author | undefined {
  if (!isRecord(author) || !nonEmpty(author.id) || !nonEmpty(author.displayName)) return undefined;
  if (author.avatarUrl !== undefined && author.avatarUrl !== null && typeof author.avatarUrl !== 'string') return undefined;
  return { id: author.id, displayName: author.displayName.trim(), avatarUrl: (author.avatarUrl as string | null | undefined) || null };
}

function parseCapture(common: CommonEvent, body: Record<string, unknown>): CaptureEvent | undefined {
  const { spentKamas, lines } = body;
  const author = parseAuthor(body.author);
  if (!author) return undefined;
  if (!isKamasInteger(spentKamas, 0) || !Array.isArray(lines) || lines.length > MAX_LINES) return undefined;
  return { ...common, author, spentKamas, lines };
}

// specs/028 (FR-009, research R3): a close requested from the site that the bot hasn't run yet.
const pendingClose = async (db: FmDb, channelId: string) =>
  (await db.prepare("SELECT 1 AS pending FROM fm_bot_commands WHERE channel_id = ? AND type = 'close' AND status = 'pending' LIMIT 1")
    .bind(channelId).first()) !== null;

function parseLine(value: unknown): PurchaseLineInput | undefined {
  if (!isRecord(value) || !isItemName(value.name) || !isKamasInteger(value.qty, 1) || !isKamasInteger(value.price, 1)) return undefined;
  return { name: value.name, quantity: value.qty, totalKamas: value.price };
}

async function openSessionId(db: FmDb, channelId: string): Promise<string | undefined> {
  const row = await db.prepare("SELECT id FROM fm_sessions WHERE channel_id = ? AND status = 'open'").bind(channelId).first<{ id: string }>();
  return row?.id;
}

const closeOpenSession = (db: FmDb, channelId: string, at: string) =>
  db.prepare("UPDATE fm_sessions SET status = 'closed', closed_at = ? WHERE channel_id = ? AND status = 'open'").bind(at, channelId);

const openSession = (db: FmDb, id: string, event: CommonEvent, ownerId: string | null = null) =>
  db.prepare("INSERT INTO fm_sessions (id, channel_id, channel_name, status, opened_at, owner_discord_user_id) VALUES (?, ?, ?, 'open', ?, ?)")
    .bind(id, event.channelId, event.channelName, event.occurredAt, ownerId);

const processedStatement = (db: FmDb, event: CommonEvent, answer: EventAnswer) =>
  db.prepare('INSERT INTO fm_processed_events (event_id, type, response, received_at) VALUES (?, ?, ?, ?)')
    .bind(event.eventId, event.type, JSON.stringify(answer), nowIso());

async function handleCapture(db: FmDb, event: CaptureEvent): Promise<{ answer: EventAnswer; statements: FmStatement[] }> {
  const statements: FmStatement[] = [];
  // No open session (the Worker was unreachable during /fmstart, or the session predates the bot's
  // update): open one at the capture's date, so nothing the bot counted is lost (research R4).
  let sessionId = await openSessionId(db, event.channelId);
  // specs/028 FR-009: the session was stopped from the site and the bot hasn't closed it yet — the
  // capture must not reopen one.
  if (!sessionId && await pendingClose(db, event.channelId)) {
    return { answer: { status: 'ignored', reason: 'session-closed', duplicate: false }, statements: [] };
  }
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    statements.push(openSession(db, sessionId, event));
  }

  await upsertPlayerStatement(db, { discordUserId: event.author.id, displayName: event.author.displayName, avatarUrl: event.author.avatarUrl }, event.occurredAt).run();
  const player = await db.prepare('SELECT server_id FROM fm_players WHERE discord_user_id = ?').bind(event.author.id).first<{ server_id: string | null }>();
  const serverId = player?.server_id ?? null;

  const answers: LineAnswer[] = [];
  const resolved: ResolvedLine[] = [];
  for (const [index, raw] of event.lines.entries()) {
    const line = parseLine(raw);
    if (!line) {
      answers.push({ index, name: isRecord(raw) && typeof raw.name === 'string' ? raw.name : '', unitPriceKamas: null, priceStatus: 'invalid' });
      continue;
    }
    const result = await resolveBotLine(db, line, { discordUserId: event.author.id, serverId });
    resolved.push(result);
    answers.push({ index, name: line.name, unitPriceKamas: unitPriceKamas(line), priceStatus: result.priceStatus });
  }
  clearCachedReadsIfPriced(resolved);

  const captureId = crypto.randomUUID();
  statements.push(db.prepare(
    `INSERT INTO fm_captures (id, session_id, discord_user_id, origin, spent_kamas, server_id, created_at) VALUES (?, ?, ?, 'bot', ?, ?, ?)`,
  ).bind(captureId, sessionId, event.author.id, event.spentKamas, serverId, event.occurredAt));
  statements.push(...purchaseLineStatements(db, captureId, resolved));
  return { answer: { status: 'ok', sessionId, duplicate: false, lines: answers }, statements };
}

async function handleSessionChange(db: FmDb, event: CommonEvent, author?: Author): Promise<{ answer: EventAnswer; statements: FmStatement[] }> {
  if (event.type === 'session-start') {
    const sessionId = crypto.randomUUID();
    // specs/028 FR-005: whoever typed /fmstart owns the session (optional for an older bot).
    return {
      answer: { status: 'ok', sessionId, duplicate: false },
      statements: [
        ...(author ? [upsertPlayerStatement(db, { discordUserId: author.id, displayName: author.displayName, avatarUrl: author.avatarUrl }, event.occurredAt)] : []),
        closeOpenSession(db, event.channelId, event.occurredAt),
        openSession(db, sessionId, event, author?.id ?? null),
      ],
    };
  }
  // specs/028 FR-012: /fmstop makes any close still queued for this channel pointless.
  const cancelCloses = event.type === 'session-stop'
    ? [db.prepare("UPDATE fm_bot_commands SET status = 'cancelled', acknowledged_at = ? WHERE channel_id = ? AND type = 'close' AND status = 'pending'").bind(nowIso(), event.channelId)]
    : [];
  const sessionId = await openSessionId(db, event.channelId);
  if (!sessionId) return { answer: { status: 'ignored', duplicate: false }, statements: cancelCloses };
  if (event.type === 'session-stop') {
    return { answer: { status: 'ok', sessionId, duplicate: false }, statements: [closeOpenSession(db, event.channelId, event.occurredAt), ...cancelCloses] };
  }
  // session-reset: like the bot's empty_session(), the session's purchases are gone; it stays open.
  return {
    answer: { status: 'ok', sessionId, duplicate: false },
    statements: [
      db.prepare('DELETE FROM fm_purchase_lines WHERE capture_id IN (SELECT id FROM fm_captures WHERE session_id = ?)').bind(sessionId),
      db.prepare('DELETE FROM fm_captures WHERE session_id = ?').bind(sessionId),
    ],
  };
}

export async function handleBotEvent(request: Request, env: FmEnv): Promise<Response> {
  // A key of its own, never the site's public COMMUNITY_API_KEY (FR-009).
  const key = env.FM_BOT_API_KEY ?? '';
  if (!key || request.headers.get('Authorization') !== `Bearer ${key}`) return unauthorized();

  const body = await readJson(request);
  const common = parseCommon(body);
  if (!common) return json({ error: 'type, eventId, channelId, channelName and a valid occurredAt are required' }, 400);
  const capture = common.type === 'capture' ? parseCapture(common, body as Record<string, unknown>) : undefined;
  if (common.type === 'capture' && !capture) {
    return json({ error: `a capture needs author.id, author.displayName, spentKamas and at most ${MAX_LINES} lines` }, 400);
  }
  const rawAuthor = common.type === 'session-start' ? (body as Record<string, unknown>).author : undefined;
  const startAuthor = rawAuthor === undefined || rawAuthor === null ? undefined : parseAuthor(rawAuthor);
  if (rawAuthor !== undefined && rawAuthor !== null && !startAuthor) return json({ error: 'author needs an id and a displayName' }, 400);

  // FR-020: a resend of the same Discord message or interaction changes nothing.
  const processed = await env.DB.prepare('SELECT response FROM fm_processed_events WHERE event_id = ?').bind(common.eventId).first<{ response: string }>();
  if (processed) return json({ ...(JSON.parse(processed.response) as EventAnswer), duplicate: true });

  const { answer, statements } = capture ? await handleCapture(env.DB, capture) : await handleSessionChange(env.DB, common, startAuthor);
  await env.DB.batch([...statements, processedStatement(env.DB, common, answer)]);
  return json(answer);
}
