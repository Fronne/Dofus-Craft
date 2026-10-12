import { fetchCurrentMedian, insertContribution } from '../contribution';
import { clearReadCache } from '../read-cache';
import { computeDeviationPercent, OUTLIER_THRESHOLD_PERCENT } from '../outlier';
import { lookupItem, normalizeItemName } from './item-names';
import { sha256Hex, type FmDb } from './http';

// specs/025-rune-purchase-import (research R8, FR-019): the resource price a purchase line creates, or
// why it creates none. The spending never depends on it.

export const MAX_KAMAS = 2_000_000_000;
export const MAX_LINES = 200;
export const MAX_NAME_LENGTH = 80;

export type PriceStatus = 'recorded' | 'unknown-item' | 'ambiguous-item' | 'no-server' | 'outlier' | 'personal-mode';
export type PurchaseLineInput = { name: string; quantity: number; totalKamas: number };

export const unitPriceKamas = (line: { quantity: number; totalKamas: number }) => Math.round(line.totalKamas / line.quantity);

export function isKamasInteger(value: unknown, minimum: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= MAX_KAMAS;
}

export function isItemName(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= MAX_NAME_LENGTH;
}

// The price contributions of a player count once in the median (latestPerDevice), without the
// Discord id itself ever reaching the price table: a stable pseudonym per player.
export async function playerDeviceId(discordUserId: string): Promise<string> {
  return `fm:${(await sha256Hex(discordUserId)).slice(0, 16)}`;
}

export async function recordLinePrice(db: FmDb, input: {
  itemId: string;
  serverId: string;
  unitPriceKamas: number;
  discordUserId: string;
  origin: 'capture' | 'bot';
  /** The bot can't ask for a confirmation: past the specs/007 threshold, no price (clarification Q1). */
  checkOutlier: boolean;
}): Promise<{ priceStatus: 'recorded' | 'outlier'; contributionId?: string }> {
  if (input.checkOutlier) {
    const median = await fetchCurrentMedian(db, input.itemId, input.serverId);
    if (median && computeDeviationPercent(input.unitPriceKamas, median.medianAmountKamas) > OUTLIER_THRESHOLD_PERCENT) {
      return { priceStatus: 'outlier' };
    }
  }
  const contributionId = await insertContribution(db, {
    resourceId: input.itemId,
    serverId: input.serverId,
    amountKamas: input.unitPriceKamas,
    deviceId: await playerDeviceId(input.discordUserId),
    kind: 'resource',
    origin: input.origin,
  });
  return { priceStatus: 'recorded', contributionId };
}

// `readName`: the name as it was read, when the item was recovered from it (specs/038). `counted`: whether
// the line counts in the spending — only runes do (specs/044-fm-runes-only).
export type ResolvedLine = PurchaseLineInput & {
  readName: string | null; itemId: string | null; unitPriceKamas: number; priceStatus: PriceStatus; contributionId: string | null; counted: boolean;
};

export const isRuneName = (name: string) => normalizeItemName(name).startsWith('rune ');

// The bot only counts the lines above this total in what it reports as spent.
const BOT_COUNTS_ABOVE_KAMAS = 1000;
export const botUncountedKamas = (lines: { counted: boolean; totalKamas: number }[]) =>
  lines.reduce((total, line) => total + (!line.counted && line.totalKamas > BOT_COUNTS_ABOVE_KAMAS ? line.totalKamas : 0), 0);

// A bot line: recognized by its name, priced on the player's server, outliers left out.
export async function resolveBotLine(db: FmDb, sent: PurchaseLineInput, player: { discordUserId: string; serverId: string | null }): Promise<ResolvedLine> {
  const unit = unitPriceKamas(sent);
  const lookup = lookupItem(sent.name);
  if (lookup.status !== 'found') {
    return { ...sent, readName: null, itemId: null, unitPriceKamas: unit, priceStatus: lookup.status, contributionId: null, counted: isRuneName(sent.name) };
  }
  const named = lookup.name ? { ...sent, name: lookup.name, readName: sent.name.trim() } : { ...sent, readName: null };
  const line = { ...named, counted: isRuneName(named.name) };
  if (!player.serverId) return { ...line, itemId: lookup.itemId, unitPriceKamas: unit, priceStatus: 'no-server', contributionId: null };
  const { priceStatus, contributionId } = await recordLinePrice(db, {
    itemId: lookup.itemId,
    serverId: player.serverId,
    unitPriceKamas: unit,
    discordUserId: player.discordUserId,
    origin: 'bot',
    checkOutlier: true,
  });
  return { ...line, itemId: lookup.itemId, unitPriceKamas: unit, priceStatus, contributionId: contributionId ?? null };
}

// specs/021 (FR-013): once a price is recorded, this isolate's cached reads no longer reflect the database.
export function clearCachedReadsIfPriced(lines: { priceStatus: PriceStatus }[]): void {
  if (lines.some((line) => line.priceStatus === 'recorded')) clearReadCache();
}

export function purchaseLineStatements(db: FmDb, captureId: string, lines: ResolvedLine[]) {
  return lines.map((line, position) => db.prepare(
    `INSERT INTO fm_purchase_lines (id, capture_id, position, item_name, original_item_name, item_id, quantity, total_kamas, unit_price_kamas, contribution_id, price_status, counted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(crypto.randomUUID(), captureId, position, line.name.trim(), line.readName, line.itemId, line.quantity, line.totalKamas, line.unitPriceKamas, line.contributionId, line.priceStatus, line.counted ? 1 : 0));
}
