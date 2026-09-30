import { isRecord, json, nowIso, readJson, type FmDb } from './http';
import { isPriceableItemId } from './item-names';
import {
  clearCachedReadsIfPriced, isItemName, isKamasInteger, MAX_LINES, purchaseLineStatements, recordLinePrice,
  unitPriceKamas, type ResolvedLine,
} from './purchases';

// specs/025-rune-purchase-import (contracts/fm-site-api.md, US5): POST /fm/imports — the lines a player
// validated after reading a capture on their own device. The image never reaches the Worker (FR-025).

type ImportLine = { itemName: string; itemId: string; quantity: number; totalKamas: number };

function parseImportLine(value: unknown): ImportLine | undefined {
  if (!isRecord(value) || !isItemName(value.itemName) || typeof value.itemId !== 'string') return undefined;
  if (!isPriceableItemId(value.itemId) || !isKamasInteger(value.quantity, 1) || !isKamasInteger(value.totalKamas, 1)) return undefined;
  return { itemName: value.itemName, itemId: value.itemId, quantity: value.quantity, totalKamas: value.totalKamas };
}

export async function handleImport(request: Request, db: FmDb, discordUserId: string): Promise<Response> {
  const body = await readJson(request);
  if (!isRecord(body) || typeof body.sharePrices !== 'boolean' || !Array.isArray(body.lines) || body.lines.length === 0 || body.lines.length > MAX_LINES) {
    return json({ error: `sharePrices and 1 to ${MAX_LINES} lines are required` }, 400);
  }
  const lines = body.lines.map(parseImportLine);
  if (lines.some((line) => !line)) return json({ error: 'each line needs itemName, a known itemId, a quantity and a total' }, 400);

  // specs/028 FR-013: optionally into one of the player's open sessions instead of « hors session ».
  let sessionId: string | null = null;
  if (body.sessionId !== undefined && body.sessionId !== null) {
    if (typeof body.sessionId !== 'string') return json({ error: 'sessionId must be a string' }, 400);
    const session = await db.prepare('SELECT status, owner_discord_user_id FROM fm_sessions WHERE id = ?')
      .bind(body.sessionId).first<{ status: string; owner_discord_user_id: string | null }>();
    if (!session) return json({ error: 'Not found' }, 404);
    if (session.owner_discord_user_id !== discordUserId) return json({ error: 'Forbidden' }, 403);
    if (session.status !== 'open') return json({ error: 'session-not-open' }, 409);
    sessionId = body.sessionId;
  }

  const player = await db.prepare('SELECT server_id FROM fm_players WHERE discord_user_id = ?').bind(discordUserId).first<{ server_id: string | null }>();
  const serverId = player?.server_id;
  if (!serverId) return json({ error: 'no-server' }, 409);

  const resolved: ResolvedLine[] = [];
  for (const line of lines as ImportLine[]) {
    const unit = unitPriceKamas(line);
    // The site already asked for the specs/007 confirmation: no outlier filter here. In personal
    // mode, nothing is shared — the site keeps the price on the device.
    const price = body.sharePrices
      ? await recordLinePrice(db, { itemId: line.itemId, serverId, unitPriceKamas: unit, discordUserId, origin: 'capture', checkOutlier: false })
      : { priceStatus: 'personal-mode' as const, contributionId: undefined };
    resolved.push({
      name: line.itemName,
      quantity: line.quantity,
      totalKamas: line.totalKamas,
      itemId: line.itemId,
      unitPriceKamas: unit,
      priceStatus: price.priceStatus,
      contributionId: price.contributionId ?? null,
    });
  }
  clearCachedReadsIfPriced(resolved);

  const captureId = crypto.randomUUID();
  const spentKamas = resolved.reduce((total, line) => total + line.totalKamas, 0);
  await db.batch([
    db.prepare(`INSERT INTO fm_captures (id, session_id, discord_user_id, origin, spent_kamas, server_id, created_at) VALUES (?, ?, ?, 'capture', ?, ?, ?)`)
      .bind(captureId, sessionId, discordUserId, spentKamas, serverId, nowIso()),
    ...purchaseLineStatements(db, captureId, resolved),
  ]);
  return json({
    captureId,
    lines: resolved.map((line, index) => ({ index, unitPriceKamas: line.unitPriceKamas, priceStatus: line.priceStatus })),
  }, 201);
}
