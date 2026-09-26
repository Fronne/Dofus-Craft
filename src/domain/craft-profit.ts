import type { Comparison } from './types';
import { normalizeSearchText } from '../services/dofusdb-api';

// specs/019-craft-profit-list (data-model.md « Ligne de bénéfice »): one line of the Prix page — an
// item whose HDV price is known and whose craft cost, computed exactly like the Recherche page in
// « Auto », is complete. Anything partial gives no line at all (FR-009).

export type ProfitItem = { id: string; name: string; imageUrl?: string };

export type CraftProfitRow = {
  item: ProfitItem;
  marketPriceKamas: number;
  marketPriceDate: string;
  craftCostKamas: number;
  profitKamas: number;
  // Absent when the craft costs nothing: a percentage of zero means nothing.
  marginPercent?: number;
};

// The column the list is sorted by (a click on its header) and in which direction.
export type ProfitSortKey = 'name' | 'market' | 'cost' | 'kamas' | 'percent';
export type ProfitSort = { key: ProfitSortKey; direction: 'asc' | 'desc' };
export const DEFAULT_PROFIT_SORT: ProfitSort = { key: 'kamas', direction: 'desc' };

export function profitRow(item: ProfitItem, comparison: Comparison, marketPriceDate: string): CraftProfitRow | undefined {
  const marketPriceKamas = comparison.marketPriceKamas;
  if (comparison.craftCostStatus !== 'complete' || marketPriceKamas === undefined) return undefined;
  const craftCostKamas = comparison.knownCraftCostKamas;
  const profitKamas = marketPriceKamas - craftCostKamas;
  const row: CraftProfitRow = { item, marketPriceKamas, marketPriceDate, craftCostKamas, profitKamas };
  if (craftCostKamas > 0) row.marginPercent = Math.round((profitKamas / craftCostKamas) * 100);
  return row;
}

const SORT_VALUE: Record<Exclude<ProfitSortKey, 'name'>, (row: CraftProfitRow) => number | undefined> = {
  market: (row) => row.marketPriceKamas,
  cost: (row) => row.craftCostKamas,
  kamas: (row) => row.profitKamas,
  percent: (row) => row.marginPercent,
};

// FR-006 (revised 2026-09-26: sorting by clicking a column): by the chosen column in the chosen
// direction, ties broken by name; a missing margin always comes last.
export function sortProfitRows(rows: CraftProfitRow[], sort: ProfitSort): CraftProfitRow[] {
  const sign = sort.direction === 'asc' ? 1 : -1;
  const byName = (left: CraftProfitRow, right: CraftProfitRow) => left.item.name.localeCompare(right.item.name, 'fr');
  if (sort.key === 'name') return [...rows].sort((left, right) => sign * byName(left, right));
  const value = SORT_VALUE[sort.key];
  return [...rows].sort((left, right) => {
    const a = value(left);
    const b = value(right);
    if (a === undefined || b === undefined) return a === b ? byName(left, right) : a === undefined ? 1 : -1;
    return sign * (a - b) || byName(left, right);
  });
}

export function filterProfitRows(rows: CraftProfitRow[], query: string): CraftProfitRow[] {
  const normalized = normalizeSearchText(query);
  return normalized ? rows.filter((row) => normalizeSearchText(row.item.name).includes(normalized)) : rows;
}
