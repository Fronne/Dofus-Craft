import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import runeItems from '../../data/rune-items.json';
import { getCategories } from '../../data/catalogue-repository';
import { defaultBrisageSettings } from '../../domain/brisage';
import { levelRangeError } from '../../domain/brisage-search';
import {
  bestExoFor, buildRanking, filterRows, sortRows,
  type RankingColumn, type RankingContext, type RankingExo, type RankingRow, type RankingView,
} from '../../domain/brisage-ranking';
import type { RuneItemsData } from '../../domain/forgemagie';
import type { PriceMode } from '../../domain/price-modes';
import type { Category } from '../../domain/types';
import { useRankingData } from './useRankingData';

// specs/072-classement-brisage: state and effects of the « Classement » tab (RankingTab shows them).

const RUNES = (runeItems as RuneItemsData).runes;
const SETTINGS = defaultBrisageSettings();
/** The exos are worked out this many items at a time, after the first display, so the table is never blocked. */
const EXO_CHUNK = 40;
/** Rows drawn per group; « Afficher plus » adds as many again, so thousands of items stay quick to sort and filter (SC-003). */
export const PAGE_SIZE = 100;

/** The exo already worked out for each item of a server and price mode, with what it was worked out from. */
const exoCache = new Map<string, Map<string, { key: string; exo: RankingExo | null }>>();
/** Forgets the exos kept (tests). */
export function forgetExoCache(): void {
  exoCache.clear();
}

/** Where the player was in the list when an item page was opened, taken back when the list comes back. */
type Place = { scope: string; limit: number; scrollY: number };
let lastPlace: Place | undefined;
/** Forgets the place kept (tests). */
export function forgetRankingPlace(): void {
  lastPlace = undefined;
}

export type RankingOpenItem = { id: string; name: string; level: number; imageUrl?: string };

export function useRankingTab({ serverId, priceMode, view, onView, onOpen }: {
  serverId: string | undefined;
  priceMode: PriceMode;
  view: RankingView;
  onView: (view: RankingView) => void;
  onOpen: (item: RankingOpenItem) => void;
}) {
  const data = useRankingData(serverId, priceMode);
  const [categories, setCategories] = useState<Category[]>([]);
  const [exos, setExos] = useState<{ key: object; byItem: Map<string, RankingExo | null>; done: boolean }>();
  const placeScope = `${serverId}:${priceMode}`;
  // The place is only for the arrival that follows an item page: it is used up here, so a later arrival starts at the top.
  const [place] = useState(() => (lastPlace?.scope === placeScope ? lastPlace : undefined));
  useEffect(() => { lastPlace = undefined; }, []);
  const [limit, setLimit] = useState(place?.limit ?? PAGE_SIZE);
  const scrollRestored = useRef(false);

  useEffect(() => {
    let cancelled = false;
    // The categories only label the filter: without them the table still works.
    getCategories().then((list) => { if (!cancelled) setCategories(list.filter((category) => category.kind === 'Equipment')); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const context = useMemo<RankingContext>(() => ({
    runes: RUNES, settings: SETTINGS, runePrices: data.runePrices, runePriceDates: data.runePriceDates,
    itemPrices: data.itemPrices, coefficients: data.coefficients,
  }), [data.runePrices, data.runePriceDates, data.itemPrices, data.coefficients]);
  const rows = useMemo(() => (data.status === 'ready' ? buildRanking(data.items, context) : []), [data, context]);

  // The best exo of each item is worked out after the first display, a few items at a time (specs/072 T030).
  const exoKey = rows;
  useEffect(() => {
    if (rows.length === 0) return;
    let cancelled = false;
    const itemById = new Map(data.items.map((item) => [item.id, item]));
    // An exo only depends on the price of the item, its coefficient and the prices of the runes: one already worked out
    // for the same three is taken back as it is, so coming back to the tab (or a new coefficient) only costs what changed.
    const runeSignature = JSON.stringify(Object.entries(data.runePrices).sort(([a], [b]) => a.localeCompare(b)));
    const scope = `${serverId}:${priceMode}`;
    const kept = exoCache.get(scope) ?? new Map<string, { key: string; exo: RankingExo | null }>();
    exoCache.set(scope, kept);
    const keyOf = (row: RankingRow) => `${row.priceKamas}|${row.coefficient ?? ''}|${runeSignature}`;
    const byItem = new Map<string, RankingExo | null>();
    const todo: RankingRow[] = [];
    for (const row of rows) {
      if (row.status !== 'ok') continue;
      const hit = kept.get(row.itemId);
      if (hit && hit.key === keyOf(row)) byItem.set(row.itemId, hit.exo);
      else todo.push(row);
    }
    let position = 0;
    const step = () => {
      if (cancelled) return;
      for (const row of todo.slice(position, position + EXO_CHUNK)) {
        const item = itemById.get(row.itemId);
        const exo = item ? bestExoFor(item, row, context) ?? null : null;
        byItem.set(row.itemId, exo);
        kept.set(row.itemId, { key: keyOf(row), exo });
      }
      position += EXO_CHUNK;
      const done = position >= todo.length;
      setExos({ key: exoKey, byItem: new Map(byItem), done });
      if (!done) window.setTimeout(step, 0);
    };
    // Everything kept is shown at once; only the rest is worked out, a few items at a time.
    if (todo.length === 0) setExos({ key: exoKey, byItem, done: true });
    else window.setTimeout(step, 0);
    return () => { cancelled = true; };
  }, [rows, data.items, data.runePrices, context, exoKey, serverId, priceMode]);

  const exosPending = rows.some((row) => row.status === 'ok') && !(exos?.key === exoKey && exos.done);

  const withExos = useMemo(
    () => rows.map((row) => { const exo = exos?.key === exoKey ? exos.byItem.get(row.itemId) : undefined; return exo ? { ...row, exo } : row; }),
    [rows, exos, exoKey],
  );
  const shown = useMemo(() => filterRows(withExos, view), [withExos, view]);
  const known = useMemo(() => sortRows(shown.filter((row) => row.group === 'known'), view.sortColumn, view.sortDirection), [shown, view.sortColumn, view.sortDirection]);
  const unknown = useMemo(() => sortRows(shown.filter((row) => row.group === 'unknown'), view.sortColumn, view.sortDirection), [shown, view.sortColumn, view.sortDirection]);

  const update = (change: Partial<RankingView>) => onView({ ...view, ...change });
  const sortBy = (column: RankingColumn) => update(view.sortColumn === column
    ? { sortDirection: view.sortDirection === 'desc' ? 'asc' : 'desc' }
    : { sortColumn: column, sortDirection: column === 'name' || column === 'threshold' ? 'asc' : 'desc' });
  const rangeError = levelRangeError({ minLevel: view.minLevel, maxLevel: view.maxLevel });

  // Coming back from an item page, the list is where it was left (same number of rows, same scroll) instead of at the top.
  const hasRows = shown.length > 0;
  useLayoutEffect(() => {
    if (scrollRestored.current || !hasRows) return;
    scrollRestored.current = true;
    if (place) window.scrollTo(0, place.scrollY);
  }, [hasRows, place]);

  const openRow = (row: RankingRow) => {
    lastPlace = { scope: placeScope, limit, scrollY: window.scrollY };
    onOpen({ id: row.itemId, name: row.name, level: row.level, imageUrl: row.imageUrl });
  };

  const hasMore = known.length > limit || unknown.length > limit;

  return { data, categories, rows, shown, known, unknown, exosPending, limit, setLimit, hasMore, update, sortBy, rangeError, openRow };
}
