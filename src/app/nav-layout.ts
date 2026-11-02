// Which entries of the top bar are shown as they are, and which go into a menu, for a given width.
// The pages are of three kinds: free links (Recherche, Suivis, Rentabilité), the « Marché » pages (HDV and
// Bons plans: links while the bar has room, one « Marché » menu when it has not) and the « Outils » pages
// (always one « Outils » menu). When even that does not fit, the least important free links go to « Plus ».
export type NavGroup = 'market' | 'tools';

export interface LayoutItem {
  to: string;
  priority: number;
  group?: NavGroup;
}

export const groupKey = (group: NavGroup) => `group:${group}`;

export interface LayoutInput {
  items: LayoutItem[];
  /** Natural width of each entry, by key: a link's `to`, or a menu's `groupKey`. */
  widths: Record<string, number>;
  room: number;
  gap: number;
  /** Width of the « Plus » button, taken from the room as soon as one link is left out. */
  moreWidth: number;
  /** The phone's bottom bar shares its width between every link: no menu at all. */
  compact: boolean;
}

/** The keys of the entries shown on the bar. A page that is neither shown as a link nor inside a shown menu is in « Plus ». */
export function layoutNav({ items, widths, room, gap, moreWidth, compact }: LayoutInput): Set<string> {
  if (compact) return new Set(items.map((item) => item.to));
  const market = items.filter((item) => item.group === 'market');
  const marketMenu = market.length >= 2;
  const toolsKeys = items.some((item) => item.group === 'tools') ? [groupKey('tools')] : [];
  const width = (keys: string[]) => keys.reduce((sum, key, index) => sum + (widths[key] ?? 0) + (index ? gap : 0), 0);

  const links = items.filter((item) => item.group !== 'tools').map((item) => item.to);
  if (width([...links, ...toolsKeys]) <= room) return new Set([...links, ...toolsKeys]);

  // The pages the bar may do without: the free links, and the Marché ones when they have no menu of their own.
  const droppable = items.filter((item) => item.group !== 'tools' && !(marketMenu && item.group === 'market'));
  const fixed = [...(marketMenu ? [groupKey('market')] : []), ...toolsKeys];
  const kept = [...droppable.map((item) => item.to), ...fixed];
  if (marketMenu && width(kept) <= room) return new Set(kept);

  const limit = room - moreWidth - gap;
  const shown = new Set(fixed);
  const byPriority = droppable
    .map((item, index) => ({ item, index }))
    .sort((a, b) => b.item.priority - a.item.priority || a.index - b.index);
  for (const { item } of byPriority) {
    // The first page is kept whatever the room: a bar with no way to the main page is worse than a tight one.
    if (shown.size > fixed.length && width([...shown, item.to]) > limit) break;
    shown.add(item.to);
  }
  return shown;
}
