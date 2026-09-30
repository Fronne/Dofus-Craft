import { isRecord, json, noContent, nowIso, readJson, type FmDb } from './http';
import { effectiveItemSql, ITEMS_SELECT, itemSummaries, ownedItems, placeholders, SESSION_COLUMNS, sessionDetail, withPlayers, type ItemRow, type SessionRow } from './reads';

// specs/027-fm-item-recap (contracts/fm-items-api.md): the items a player forgemages ("objets en FM"),
// their recap, and attaching a session to one of them. Only the owner changes an item (FR-002); a
// session goes to at most one item (FR-006), attached by a player who spent in it (FR-005).

const MAX_ITEM_NAME_LENGTH = 80;
const MAX_LABEL_LENGTH = 40;
const ICON_PREFIX = 'https://api.dofusdb.fr/';

type ItemInput = { itemId: string; itemName: string; imageUrl: string | null; label: string | null };

// research R3: the Worker has no equipment catalogue; it checks the shape of what the site sends, and
// only shows icons from DofusDB to other members.
function parseLabel(value: unknown): { ok: true; label: string | null } | { ok: false } {
  if (value === undefined || value === null) return { ok: true, label: null };
  if (typeof value !== 'string') return { ok: false };
  const label = value.trim();
  return label.length >= 1 && label.length <= MAX_LABEL_LENGTH ? { ok: true, label } : { ok: false };
}

function parseItemInput(value: unknown): ItemInput | undefined {
  if (!isRecord(value)) return undefined;
  const { itemId, itemName, imageUrl } = value;
  if (typeof itemId !== 'string' || !/^\d+$/.test(itemId)) return undefined;
  if (typeof itemName !== 'string' || itemName.trim().length === 0 || itemName.length > MAX_ITEM_NAME_LENGTH) return undefined;
  if (imageUrl !== undefined && imageUrl !== null && (typeof imageUrl !== 'string' || !imageUrl.startsWith(ICON_PREFIX))) return undefined;
  const label = parseLabel(value.label);
  if (!label.ok) return undefined;
  return { itemId, itemName: itemName.trim(), imageUrl: (imageUrl as string | null | undefined) ?? null, label: label.label };
}

async function ownItem(db: FmDb, viewerId: string, id: string) {
  const [item] = await ownedItems(db, viewerId, 'i.id = ? AND i.owner_discord_user_id = ?', id, viewerId);
  return item;
}

const notFound = () => json({ error: 'Not found' }, 404);

export async function createItem(request: Request, db: FmDb, viewerId: string): Promise<Response> {
  const input = parseItemInput(await readJson(request));
  if (!input) {
    return json({ error: `itemId (digits), itemName (1 to ${MAX_ITEM_NAME_LENGTH} characters), imageUrl (${ICON_PREFIX}… or null) and an optional label (1 to ${MAX_LABEL_LENGTH} characters) are required` }, 400);
  }
  const id = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO fm_items (id, owner_discord_user_id, item_id, item_name, item_image_url, label, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, viewerId, input.itemId, input.itemName, input.imageUrl, input.label, nowIso()).run();
  return json(await ownItem(db, viewerId, id), 201);
}

export async function renameItem(request: Request, db: FmDb, viewerId: string, id: string): Promise<Response> {
  const body = await readJson(request);
  const label = parseLabel(isRecord(body) ? body.label : undefined);
  if (!isRecord(body) || !('label' in body) || !label.ok) return json({ error: `label (1 to ${MAX_LABEL_LENGTH} characters, or null) is required` }, 400);
  if (!(await ownItem(db, viewerId, id))) return notFound();
  await db.prepare('UPDATE fm_items SET label = ? WHERE id = ? AND owner_discord_user_id = ?').bind(label.label, id, viewerId).run();
  return json(await ownItem(db, viewerId, id));
}

// FR-004: the sessions stay, no longer attached.
export async function deleteItem(db: FmDb, viewerId: string, id: string): Promise<Response> {
  if (!(await ownItem(db, viewerId, id))) return notFound();
  await db.batch([
    db.prepare('UPDATE fm_sessions SET fm_item_id = NULL WHERE fm_item_id = ?').bind(id),
    db.prepare('UPDATE fm_channels SET fm_item_id = NULL WHERE fm_item_id = ?').bind(id),
    db.prepare('DELETE FROM fm_items WHERE id = ? AND owner_discord_user_id = ?').bind(id, viewerId),
  ]);
  return noContent();
}

// FR-009 to FR-012: total, attached sessions and per-item detail — no share per player. A private
// owner's item doesn't exist for anyone else (FR-014).
export async function readItemRecap(db: FmDb, viewerId: string, id: string): Promise<Response> {
  // specs/030 FR-007: only the owner reads the recap of an item.
  const [item] = await ownedItems(db, viewerId, 'i.id = ? AND i.owner_discord_user_id = ?', id, viewerId);
  if (!item) return notFound();
  const { results: sessionRows } = await db.prepare(
    `SELECT ${SESSION_COLUMNS} FROM fm_sessions WHERE ${effectiveItemSql('fm_sessions')} = ? ORDER BY opened_at DESC, id DESC`,
  ).bind(id).all<SessionRow>();
  const sessions = await withPlayers(db, sessionRows, viewerId);
  const ids = sessionRows.map((session) => session.id);
  const { results: itemRows } = ids.length === 0
    ? { results: [] as ItemRow[] }
    : await db.prepare(`${ITEMS_SELECT} WHERE c.session_id IN (${placeholders(ids.length)}) GROUP BY l.item_name ORDER BY total_kamas DESC, l.item_name`)
      .bind(...ids).all<ItemRow>();
  return json({
    ...item,
    sessions: sessions.map((session) => ({
      id: session.id,
      channelName: session.channelName,
      status: session.status,
      openedAt: session.openedAt,
      totalKamas: session.totalKamas,
    })),
    items: itemSummaries(itemRows),
  });
}

export async function attachSession(request: Request, db: FmDb, viewerId: string, sessionId: string): Promise<Response> {
  const body = await readJson(request);
  const fmItemId = isRecord(body) && typeof body.fmItemId === 'string' ? body.fmItemId : undefined;
  // specs/031-fm-session-captures (FR-011): or an equipment, for which a new item is created.
  const newItem = isRecord(body) && fmItemId === undefined && isRecord(body.item) ? parseItemInput({ ...body.item, label: null }) : undefined;
  if (!fmItemId && !newItem) return json({ error: 'fmItemId, or item (itemId, itemName and imageUrl as for a new item), is required' }, 400);
  // specs/030 FR-004: the viewer attaches only their own session, to their own item.
  const session = await db.prepare('SELECT id, fm_item_id FROM fm_sessions WHERE id = ? AND owner_discord_user_id = ?')
    .bind(sessionId, viewerId).first<{ id: string; fm_item_id: string | null }>();
  if (!session || (fmItemId && !(await ownItem(db, viewerId, fmItemId)))) return notFound();
  // FR-006: an attached session, even to this very item, is refused.
  if (session.fm_item_id !== null) return json({ error: 'already-attached' }, 409);
  // specs/029: a session of a channel attached to an item already counts for that item.
  const channelItem = await db.prepare(
    'SELECT ch.fm_item_id FROM fm_channels ch JOIN fm_sessions s ON s.channel_id = ch.channel_id WHERE s.id = ? AND ch.fm_item_id IS NOT NULL',
  ).bind(sessionId).first();
  if (channelItem) return json({ error: 'already-attached' }, 409);

  // research R2: the condition in the same statement makes « the first one to attach wins » safe.
  const attachStatement = (id: string) => db.prepare('UPDATE fm_sessions SET fm_item_id = ? WHERE id = ? AND fm_item_id IS NULL').bind(id, sessionId);
  let targetId: string;
  if (fmItemId) {
    targetId = fmItemId;
    await attachStatement(targetId).run();
  } else {
    // specs/031 (research R4, FR-012): one batch — a transaction — creates the item, attaches the
    // session, and removes the item again if the session was attached in the meantime.
    targetId = crypto.randomUUID();
    const item = newItem!;
    await db.batch([
      db.prepare(
        `INSERT INTO fm_items (id, owner_discord_user_id, item_id, item_name, item_image_url, label, created_at) VALUES (?, ?, ?, ?, ?, NULL, ?)`,
      ).bind(targetId, viewerId, item.itemId, item.itemName, item.imageUrl, nowIso()),
      attachStatement(targetId),
      db.prepare('DELETE FROM fm_items WHERE id = ? AND NOT EXISTS (SELECT 1 FROM fm_sessions WHERE fm_item_id = ?)').bind(targetId, targetId),
    ]);
  }
  const attached = await db.prepare('SELECT fm_item_id FROM fm_sessions WHERE id = ?').bind(sessionId).first<{ fm_item_id: string | null }>();
  if (attached?.fm_item_id !== targetId) return json({ error: 'already-attached' }, 409);
  return json(await sessionDetail(db, viewerId, sessionId));
}

export async function detachSession(db: FmDb, viewerId: string, sessionId: string): Promise<Response> {
  const row = await db.prepare(
    `SELECT s.fm_item_id, i.owner_discord_user_id FROM fm_sessions s LEFT JOIN fm_items i ON i.id = s.fm_item_id
     WHERE s.id = ? AND s.owner_discord_user_id = ?`,
  ).bind(sessionId, viewerId).first<{ fm_item_id: string | null; owner_discord_user_id: string | null }>();
  // specs/030 (research R6): the session and its item must both be the viewer's, or it is not found.
  if (!row || !row.fm_item_id || row.owner_discord_user_id !== viewerId) return notFound();
  await db.prepare('UPDATE fm_sessions SET fm_item_id = NULL WHERE id = ? AND fm_item_id = ?').bind(sessionId, row.fm_item_id).run();
  return json(await sessionDetail(db, viewerId, sessionId));
}
