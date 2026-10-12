import { isRecord, json, noContent, nowIso, readJson, type FmDb, type FmStatement } from './http';
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

// An equipment chosen in place of an existing item: a new item, without a label.
export const parseNewItem = (value: unknown) => (isRecord(value) ? parseItemInput({ ...value, label: null }) : undefined);

export const insertItemStatement = (db: FmDb, id: string, viewerId: string, item: ItemInput): FmStatement =>
  db.prepare(
    `INSERT INTO fm_items (id, owner_discord_user_id, item_id, item_name, item_image_url, label, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, viewerId, item.itemId, item.itemName, item.imageUrl, item.label, nowIso());

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
  await insertItemStatement(db, id, viewerId, input).run();
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

// specs/032 (FR-022 to FR-024): the item is chosen, changed or removed at any time. In one of the viewer's
// own channels it is the channel's — every session of the channel follows; elsewhere it is the session's.
type ItemTarget = { id: string; channel_id: string; own_channel: number | null };

async function itemTarget(db: FmDb, viewerId: string, sessionId: string) {
  return db.prepare(
    `SELECT s.id, s.channel_id,
            (SELECT 1 FROM fm_channels ch WHERE ch.channel_id = s.channel_id AND ch.owner_discord_user_id = ?) AS own_channel
     FROM fm_sessions s WHERE s.id = ? AND s.owner_discord_user_id = ?`,
  ).bind(viewerId, sessionId, viewerId).first<ItemTarget>();
}

export function sessionItemStatements(db: FmDb, target: ItemTarget, fmItemId: string | null): FmStatement[] {
  return target.own_channel
    ? [
      db.prepare('UPDATE fm_channels SET fm_item_id = ? WHERE channel_id = ?').bind(fmItemId, target.channel_id),
      db.prepare('UPDATE fm_sessions SET fm_item_id = NULL WHERE channel_id = ?').bind(target.channel_id),
    ]
    : [db.prepare('UPDATE fm_sessions SET fm_item_id = ? WHERE id = ?').bind(fmItemId, target.id)];
}

export async function attachSession(request: Request, db: FmDb, viewerId: string, sessionId: string): Promise<Response> {
  const body = await readJson(request);
  const fmItemId = isRecord(body) && typeof body.fmItemId === 'string' ? body.fmItemId : undefined;
  // specs/031-fm-session-captures (FR-011): or an equipment, for which a new item is created.
  const newItem = isRecord(body) && fmItemId === undefined ? parseNewItem(body.item) : undefined;
  if (!fmItemId && !newItem) return json({ error: 'fmItemId, or item (itemId, itemName and imageUrl as for a new item), is required' }, 400);
  // specs/030 FR-004: the viewer attaches only their own session, to their own item.
  const target = await itemTarget(db, viewerId, sessionId);
  if (!target || (fmItemId && !(await ownItem(db, viewerId, fmItemId)))) return notFound();
  const targetId = fmItemId ?? crypto.randomUUID();
  await db.batch([
    ...(newItem ? [insertItemStatement(db, targetId, viewerId, newItem)] : []),
    ...sessionItemStatements(db, target, targetId),
  ]);
  return json(await sessionDetail(db, viewerId, sessionId));
}

export async function detachSession(db: FmDb, viewerId: string, sessionId: string): Promise<Response> {
  const target = await itemTarget(db, viewerId, sessionId);
  if (!target) return notFound();
  await db.batch(sessionItemStatements(db, target, null));
  return json(await sessionDetail(db, viewerId, sessionId));
}
