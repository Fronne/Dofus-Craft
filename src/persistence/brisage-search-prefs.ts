import { HUNT_EFFECT_IDS, type SearchSort } from '../domain/brisage-search';

// specs/064-recherche-objets-par-stats (FR-009): what the player chose on the "Par stats" search (the stats, the
// sort, the level range), kept on the device so leaving for an item and coming back finds it again.
const STORAGE_KEY = 'craftcheck-brisage-search';

export type SearchPrefs = {
  effectIds: number[];
  sort: SearchSort;
  minLevel?: number;
  maxLevel?: number;
  /** specs/065: the equipment category chosen on the Brisage page, every category when absent. */
  categoryId?: string;
  /** specs/065: whether the filter panel is open. */
  panelOpen: boolean;
};

const SORTS: SearchSort[] = ['runes', 'kamas', 'maxRoll'];

export function defaultSearchPrefs(): SearchPrefs {
  return { effectIds: [], sort: 'runes', panelOpen: false };
}

const level = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : undefined;

/** Reads a stored value back; anything of the wrong type falls back to the default for that field. */
export function mergeSearchPrefs(value: unknown): SearchPrefs {
  const defaults = defaultSearchPrefs();
  if (typeof value !== 'object' || value === null) return defaults;
  const raw = value as Record<string, unknown>;
  const effectIds = Array.isArray(raw.effectIds)
    ? [...new Set(raw.effectIds.filter((id): id is number => Number.isInteger(id) && !HUNT_EFFECT_IDS.includes(id)))]
    : defaults.effectIds;
  return {
    effectIds,
    sort: SORTS.includes(raw.sort as SearchSort) ? (raw.sort as SearchSort) : defaults.sort,
    minLevel: level(raw.minLevel),
    maxLevel: level(raw.maxLevel),
    categoryId: typeof raw.categoryId === 'string' && raw.categoryId !== '' ? raw.categoryId : undefined,
    panelOpen: raw.panelOpen === true,
  };
}

export function getSearchPrefs(): SearchPrefs {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === null ? defaultSearchPrefs() : mergeSearchPrefs(JSON.parse(stored));
  } catch {
    return defaultSearchPrefs();
  }
}

export function setSearchPrefs(prefs: SearchPrefs): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Private browsing or blocked storage: the choice just isn't remembered.
  }
}
