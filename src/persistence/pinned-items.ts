import type { Item } from '../domain/types';

export type PinnedItem = {
  item: Item;
};

const STORAGE_KEY = 'craftcheck-pinned-items';

function isItem(value: unknown): value is Item {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<Item>;
  return typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    (item.kind === 'Equipment' || item.kind === 'Resource') &&
    typeof item.categoryId === 'string';
}

function isRawPinnedEntry(value: unknown): value is { item: Item } {
  if (!value || typeof value !== 'object') return false;
  return isItem((value as { item?: unknown }).item);
}

function readRawEntries(): unknown[] {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadPinnedItems(): PinnedItem[] {
  return readRawEntries()
    .filter(isRawPinnedEntry)
    .map((entry) => ({ item: entry.item }));
}

export function savePinnedItems(items: PinnedItem[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/** Detects a pre-migration `marketPrice` field abandoned by FR-016, before it is stripped by `loadPinnedItems`. */
export function hasLegacyPinnedItemMarketPrice(): boolean {
  return readRawEntries().some(
    (entry) =>
      isRawPinnedEntry(entry) && typeof (entry as { marketPrice?: unknown }).marketPrice === 'string',
  );
}
