import { normalizeSearchText } from '../../services/dofusdb-api';
import { normalizeItemName } from './purchase-lines';

/** specs/049: only runes count in a séance; what the chat names « Rune … » is one. */
export function isRuneName(name: string): boolean {
  return normalizeItemName(name).startsWith('rune ');
}

// --- Runes (src/data/rune-items.json, contracts/rune-items-data.md) ---

export type RuneItem = {
  id: string;
  name: string;
  imageUrl: string;
  level: number;
  effectId: number | null;
  characteristicId: number | null;
  statLabel: string;
};

export type RuneItemsData = { source: string; sourceUrl: string; retrievedAt: string; runes: RuneItem[] };

/** The stats runes can be filtered by, in alphabetical order (FR-017). */
export function runeStatLabels(runes: RuneItem[]): string[] {
  return [...new Set(runes.map((rune) => rune.statLabel))].sort((a, b) => a.localeCompare(b, 'fr'));
}

/** specs/026: the Runes tab of the HDV page — name without accents or case, exact stat; order kept. */
export function filterRunes(runes: RuneItem[], { query, stat }: { query: string; stat: string }): RuneItem[] {
  const needle = normalizeSearchText(query);
  return runes.filter((rune) => (!stat || rune.statLabel === stat) && (!needle || normalizeSearchText(rune.name).includes(needle)));
}
