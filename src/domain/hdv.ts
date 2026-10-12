import { normalizeSearchText } from '../services/dofusdb-api';
import type { ResourcePrice } from './types';

// specs/023-hdv-price-entry: the HDV price-entry page's rules. The items of each HDV are frozen in
// src/data/hdv-items.json (research.md §1-§3); everything here is pure so it can be tested on its
// own (constitution, principe II).

// specs/026-hdv-rune-prices: 'runes' lists src/data/rune-items.json, not the items of hdv-items.json.
export type HdvId = 'resources' | 'consumables' | 'animals' | 'runes';

export const HDV_TABS: { id: HdvId; label: string }[] = [
  { id: 'resources', label: 'Ressources' },
  { id: 'consumables', label: 'Consommables' },
  { id: 'animals', label: 'Créatures' },
  { id: 'runes', label: 'Runes' },
];

export type HdvItem = { id: string; name: string; imageUrl?: string; typeId: number; hdv: HdvId };

export type HdvItemsData = {
  source: string;
  sourceUrl: string;
  typeMapCheckedAt: string;
  retrievedAt: string;
  /** Type id → French type name. */
  types: Record<string, string>;
  items: HdvItem[];
  skipped: { outOfScope: number; excluded: number; notExchangeable: number };
};

export function isHdvId(value: unknown): value is HdvId {
  return HDV_TABS.some((tab) => tab.id === value);
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'fr');

/** The items of one HDV tab, sorted by name (FR-009). */
export function itemsForHdv(data: HdvItemsData, hdv: HdvId): HdvItem[] {
  return data.items.filter((item) => item.hdv === hdv).sort(byName);
}

/** The item types present in a tab, sorted by name — the only choices of the type filter (FR-008). */
export function typesInTab(items: HdvItem[], typeNames: Record<string, string>): { id: number; name: string }[] {
  const ids = [...new Set(items.map((item) => item.typeId))];
  return ids.map((id) => ({ id, name: typeNames[String(id)] ?? `Type ${id}` })).sort(byName);
}

/** Name (accent- and case-insensitive) and type filters (FR-008). */
export function filterHdvItems(items: HdvItem[], { query, typeId }: { query: string; typeId: number | '' }): HdvItem[] {
  const needle = normalizeSearchText(query);
  return items.filter((item) =>
    (typeId === '' || item.typeId === typeId) && (!needle || normalizeSearchText(item.name).includes(needle)));
}

// specs/048-hdv-sort: the order of a tab's list. `default` is the tab's own (by name; by stat for the
// runes); the four others replace the « Sans prix » / « Prix ancien » filters of specs/023.
export type HdvSort = 'default' | 'price-desc' | 'price-asc' | 'recent' | 'oldest';

/** The named sorts, in the order of the menu — after the tab's own order. */
export const HDV_SORTS: { id: Exclude<HdvSort, 'default'>; label: string }[] = [
  { id: 'price-desc', label: 'Prix le plus élevé' },
  { id: 'price-asc', label: 'Prix le plus bas' },
  { id: 'recent', label: 'Mis à jour récemment' },
  { id: 'oldest', label: 'Mis à jour il y a longtemps' },
];

export function isHdvSort(value: unknown): value is HdvSort {
  return value === 'default' || HDV_SORTS.some((sort) => sort.id === value);
}

/**
 * specs/048 (FR-003, FR-004): the lines with a price first, by unit price or by date of the price —
 * a date that cannot be read counts as the oldest; then the lines without one. Lines that tie, and
 * the lines without a price, keep the order they came in. Never changes the list it is given.
 */
export function sortHdvLines<T extends { id: string }>(items: T[], prices: Record<string, ResourcePrice>, sort: HdvSort): T[] {
  if (sort === 'default') return items;
  const byPrice = sort === 'price-desc' || sort === 'price-asc';
  const direction = sort === 'price-asc' || sort === 'oldest' ? 1 : -1;
  const key = (price: ResourcePrice) => (byPrice ? price.unitPriceKamas : Date.parse(price.updatedAt) || 0);
  const position = new Map(items.map((item, index) => [item.id, index]));
  const priced = items.filter((item) => prices[item.id]);
  const unpriced = items.filter((item) => !prices[item.id]);
  priced.sort((a, b) => direction * (key(prices[a.id]) - key(prices[b.id])) || position.get(a.id)! - position.get(b.id)!);
  return [...priced, ...unpriced];
}

/** FR-010: how many items of the tab have a price, whatever the filters. */
export function countPriced<T extends { id: string }>(items: T[], prices: Record<string, ResourcePrice>): { priced: number; total: number } {
  return { priced: items.filter((item) => prices[item.id]).length, total: items.length };
}
