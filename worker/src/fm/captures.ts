import { fetchCurrentMedian, insertContribution } from '../contribution';
import { computeDeviationPercent, OUTLIER_THRESHOLD_PERCENT } from '../outlier';
import { clearReadCache } from '../read-cache';
import { isRecord, json, nowIso, readJson, type FmDb, type FmStatement } from './http';
import { isKamasInteger, playerDeviceId, unitPriceKamas, type PriceStatus } from './purchases';
import { readSeance } from './seances';

// specs/045-restore-production-worker (contracts/api.md, « Captures »): the owner of a séance corrects
// the quantity or the total of a capture's lines. What was first read is kept (`original_*`), the
// capture's spending follows, and a price the line shared is corrected with it.

const notFound = () => json({ error: 'Not found' }, 404);

type Correction = { id: string; quantity: number; totalKamas: number };

function parseCorrections(body: unknown): Correction[] | undefined {
  if (!isRecord(body) || !Array.isArray(body.lines) || body.lines.length === 0) return undefined;
  const corrections: Correction[] = [];
  for (const line of body.lines) {
    if (!isRecord(line) || typeof line.id !== 'string' || !isKamasInteger(line.quantity, 1) || !isKamasInteger(line.totalKamas, 1)) return undefined;
    if (corrections.some((known) => known.id === line.id)) return undefined;
    corrections.push({ id: line.id, quantity: line.quantity, totalKamas: line.totalKamas });
  }
  return corrections;
}

type CaptureRow = { id: string; channel_id: string; origin: 'bot' | 'capture'; spent_kamas: number; server_id: string | null; discord_user_id: string };
type LineRow = {
  id: string; item_id: string | null; quantity: number; total_kamas: number; original_quantity: number | null; original_total_kamas: number | null;
  contribution_id: string | null; price_status: PriceStatus;
};

// Only a line that shared its price (or would have, had it not been an outlier) shares the corrected one:
// its contribution is changed in place, removed when the new price is an outlier, created when it had none.
async function sharedPrice(db: FmDb, capture: CaptureRow, line: LineRow, unit: number): Promise<{ contributionId: string | null; priceStatus: PriceStatus }> {
  const shares = (line.price_status === 'recorded' || line.price_status === 'outlier') && line.item_id !== null && capture.server_id !== null;
  if (!shares) return { contributionId: line.contribution_id, priceStatus: line.price_status };
  const itemId = line.item_id!;
  const serverId = capture.server_id!;
  let contributionId = line.contribution_id;
  if (contributionId) {
    await db.prepare('UPDATE community_price_contributions SET amount_kamas = ? WHERE id = ?').bind(unit, contributionId).run();
  }
  const median = await fetchCurrentMedian(db, itemId, serverId);
  if (median && computeDeviationPercent(unit, median.medianAmountKamas) > OUTLIER_THRESHOLD_PERCENT) {
    if (contributionId) await db.prepare('DELETE FROM community_price_contributions WHERE id = ?').bind(contributionId).run();
    return { contributionId: null, priceStatus: 'outlier' };
  }
  if (!contributionId) {
    contributionId = await insertContribution(db, {
      resourceId: itemId,
      serverId,
      amountKamas: unit,
      deviceId: await playerDeviceId(capture.discord_user_id),
      kind: 'resource',
      origin: capture.origin,
    });
  }
  return { contributionId, priceStatus: 'recorded' };
}

export async function correctCaptureLines(request: Request, db: FmDb, viewerId: string, captureId: string): Promise<Response> {
  const corrections = parseCorrections(await readJson(request));
  if (!corrections) return json({ error: 'lines (id, a quantity of at least 1 and a total of at least 1 kama, each line once) are required' }, 400);
  // Another player's capture is not found, like a missing one.
  const capture = await db.prepare(
    `SELECT c.id, s.channel_id, c.origin, c.spent_kamas, c.server_id, c.discord_user_id
     FROM fm_captures c JOIN fm_sessions s ON s.id = c.session_id WHERE c.id = ? AND s.owner_discord_user_id = ?`,
  ).bind(captureId, viewerId).first<CaptureRow>();
  if (!capture) return notFound();
  const { results: lines } = await db.prepare(
    `SELECT id, item_id, quantity, total_kamas, original_quantity, original_total_kamas, contribution_id, price_status
     FROM fm_purchase_lines WHERE capture_id = ? AND counted = 1`,
  ).bind(captureId).all<LineRow>();
  const known = new Map(lines.map((line) => [line.id, line]));
  if (corrections.some((correction) => !known.has(correction.id))) return json({ error: 'every line must belong to this capture' }, 400);
  const at = nowIso();
  const statements: FmStatement[] = [];
  let difference = 0;
  for (const correction of corrections) {
    const line = known.get(correction.id)!;
    if (line.quantity === correction.quantity && line.total_kamas === correction.totalKamas) continue;
    const unit = unitPriceKamas(correction);
    const price = await sharedPrice(db, capture, line, unit);
    const originalQuantity = line.original_quantity ?? line.quantity;
    const originalTotal = line.original_total_kamas ?? line.total_kamas;
    // A line put back to what was first read is no longer a corrected one.
    const corrected = correction.quantity !== originalQuantity || correction.totalKamas !== originalTotal;
    difference += correction.totalKamas - line.total_kamas;
    statements.push(db.prepare(
      `UPDATE fm_purchase_lines SET quantity = ?, total_kamas = ?, unit_price_kamas = ?, original_quantity = ?, original_total_kamas = ?,
         corrected_at = ?, contribution_id = ?, price_status = ? WHERE id = ?`,
    ).bind(correction.quantity, correction.totalKamas, unit, originalQuantity, originalTotal, corrected ? at : null, price.contributionId, price.priceStatus, line.id));
  }
  if (statements.length > 0) {
    statements.push(db.prepare('UPDATE fm_captures SET spent_kamas = MAX(0, spent_kamas + ?) WHERE id = ?').bind(difference, captureId));
    await db.batch(statements);
    clearReadCache();
  }
  return readSeance(db, viewerId, capture.channel_id);
}
