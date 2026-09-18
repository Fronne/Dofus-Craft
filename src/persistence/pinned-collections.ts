// 005-pinned-item-collections: the list of collection names a player has explicitly created,
// independent of which (if any) pinned items currently belong to them — a collection can exist
// with zero items (created via the single "+ Nouvelle collection" action, then populated
// afterward from each item's own picker).
const STORAGE_KEY = 'craftcheck-pinned-collections';

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

export function loadCollectionNames(): string[] {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    const parsed: unknown = JSON.parse(stored);
    return isStringArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCollectionNames(names: string[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(names));
}
