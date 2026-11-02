import { isRecord, json, readJson, type FmDb, type FmStatement } from '../http';
import { insertItemStatement, parseNewItem } from '../items';
import { placeholders } from '../reads';
import { seanceDetail } from './detail';
import { findSeance } from './list';
import { notFound, type FoundSeance, type ItemView, type ItemViewRow } from './types';

export async function itemViews(db: FmDb, viewerId: string, ids: string[]): Promise<Map<string, ItemView>> {
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
