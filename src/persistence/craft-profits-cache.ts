import type { CraftProfitRow } from '../domain/craft-profit';
import type { PriceMode } from '../domain/price-modes';

// specs/054-rentabilite-prechargee (FR-001, FR-006, FR-007): the last complete Rentabilité list per
// server + price mode, kept on the device so the page shows it at once on the next visit while a
// fresh one is computed. Read synchronously (localStorage) so it is the page's very first render.
const KEY_PREFIX = 'craftcheck-craft-profits';
// Bump whenever the shape of a kept row changes: older lists are then ignored, never misread.
const FORMAT_VERSION = 1;
// Older than this, HDV prices have moved too much for the list to be a useful first look.
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export type KeptCraftProfits = { computedAt: string; rows: CraftProfitRow[] };

const keyOf = (serverId: string, priceMode: PriceMode) => `${KEY_PREFIX}:${serverId}:${priceMode}`;

function isRow(value: unknown): value is CraftProfitRow {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<CraftProfitRow>;
  return typeof row.item?.id === 'string' && typeof row.item.name === 'string'
    && typeof row.marketPriceDate === 'string' && !Number.isNaN(Date.parse(row.marketPriceDate))
    && Number.isFinite(row.marketPriceKamas) && Number.isFinite(row.craftCostKamas) && Number.isFinite(row.profitKamas)
    && (row.marginPercent === undefined || Number.isFinite(row.marginPercent));
}

export function readKeptCraftProfits(serverId: string, priceMode: PriceMode): KeptCraftProfits | undefined {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(keyOf(serverId, priceMode)) ?? 'null');
    if (!stored || typeof stored !== 'object') return undefined;
    const { formatVersion, computedAt, rows } = stored as { formatVersion?: unknown; computedAt?: unknown; rows?: unknown };
    if (formatVersion !== FORMAT_VERSION || typeof computedAt !== 'string' || !Array.isArray(rows)) return undefined;
    const age = Date.now() - Date.parse(computedAt);
    // A date in the future (device clock moved back) can't be told apart from a wrong one: ignored.
    if (Number.isNaN(age) || age < 0 || age > MAX_AGE_MS || !rows.every(isRow)) return undefined;
    return { computedAt, rows };
  } catch {
    return undefined;
  }
}

export function keepCraftProfits(serverId: string, priceMode: PriceMode, rows: CraftProfitRow[], computedAt: string): void {
  try {
    window.localStorage.setItem(keyOf(serverId, priceMode), JSON.stringify({ formatVersion: FORMAT_VERSION, computedAt, rows }));
  } catch {
    // Storage full or refused: the list simply isn't kept for the next visit (FR-007).
  }
}
