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

export type ProfitSort = 'kamas' | 'percent';

export function profitRow(item: ProfitItem, comparison: Comparison, marketPriceDate: string): CraftProfitRow | undefined {
  const marketPriceKamas = comparison.marketPriceKamas;
  if (comparison.craftCostStatus !== 'complete' || marketPriceKamas === undefined) return undefined;
  const craftCostKamas = comparison.knownCraftCostKamas;
  const profitKamas = marketPriceKamas - craftCostKamas;
  const row: CraftProfitRow = { item, marketPriceKamas, marketPriceDate, craftCostKamas, profitKamas };
  if (craftCostKamas > 0) row.marginPercent = Math.round((profitKamas / craftCostKamas) * 100);
  return row;
}

// FR-006: descending on the chosen criterion, ties broken by name; with no margin, last when sorting by %.
export function sortProfitRows(rows: CraftProfitRow[], sort: ProfitSort): CraftProfitRow[] {
  const value = (row: CraftProfitRow) => (sort === 'kamas' ? row.profitKamas : row.marginPercent ?? Number.NEGATIVE_INFINITY);
  return [...rows].sort((left, right) => value(right) - value(left) || left.item.name.localeCompare(right.item.name, 'fr'));
}

export function filterProfitRows(rows: CraftProfitRow[], query: string): CraftProfitRow[] {
  const normalized = normalizeSearchText(query);
  return normalized ? rows.filter((row) => normalizeSearchText(row.item.name).includes(normalized)) : rows;
}
