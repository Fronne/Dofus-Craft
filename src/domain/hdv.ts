import { normalizeSearchText } from '../services/dofusdb-api';
import { classifyPriceAge } from './price-age';
import type { ResourcePrice } from './types';

// specs/023-hdv-price-entry: the HDV price-entry page's rules. The items of each HDV are frozen in
// src/data/hdv-items.json (research.md §1-§3); everything here is pure so it can be tested on its
// own (constitution, principe II).

export type HdvId = 'resources' | 'consumables' | 'animals';

export const HDV_TABS: { id: HdvId; label: string }[] = [
  { id: 'resources', label: 'Ressources' },
  { id: 'consumables', label: 'Consommables' },
  { id: 'animals', label: 'Créatures' },
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

export type HdvPriceFilter = 'all' | 'missing' | 'old';

/**
 * FR-010: `missing` keeps the items with no entry in the active mode's carnet, `old` those whose
 * price is flagged as old by the same rule as the Recherche page (stale or expired).
 */
export function filterByPrice(items: HdvItem[], prices: Record<string, ResourcePrice>, filter: HdvPriceFilter, now: Date = new Date()): HdvItem[] {
  if (filter === 'all') return items;
  if (filter === 'missing') return items.filter((item) => !prices[item.id]);
  return items.filter((item) => {
    const price = prices[item.id];
    if (!price) return false;
    const age = classifyPriceAge(price.updatedAt, now);
    return age === 'stale' || age === 'expired';
  });
}

/** FR-010: how many items of the tab have a price, whatever the filters. */
export function countPriced(items: HdvItem[], prices: Record<string, ResourcePrice>): { priced: number; total: number } {
  return { priced: items.filter((item) => prices[item.id]).length, total: items.length };
}
