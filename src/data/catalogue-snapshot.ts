import { peekCached, seedCache } from './catalogue-cache';
import { getDofusDbCatalogueTotals, getDofusDbItemSets, getDofusDbItems } from '../services/dofusdb-api';
import type { DofusDbItem, DofusDbItemSet } from '../services/dofusdb-types';

// specs/072-snapshot-catalogue-statique: the catalogue (equipment with a recipe + item sets) ships
// with the site as static files built at deploy time, instead of being crawled page by page from
// DofusDB at launch. A cheap probe then tells, rarely, whether DofusDB has moved on since.

export const ITEM_INDEX_KEY = 'catalogue-item-index';
export const ITEM_SET_INDEX_KEY = 'item-set-index';

export type CatalogueProvenance = {
  origin: 'snapshot' | 'dofusdb';
  generatedAt: string;
  totals: { items: number; itemSets: number };
};

export type CatalogueItemIndexValue = { items: DofusDbItem[]; provenance?: CatalogueProvenance };
export type ItemSetIndexValue = {
  sets: DofusDbItemSet[];
  itemSetIdsByItemId: Map<number, Set<number>>;
  provenance?: CatalogueProvenance;
};

type SnapshotMeta = { version: 1; generatedAt: string; totals: { items: number; itemSets: number } };

/** Minimum delay between two probes of DofusDB on one device (FR-009). */
export const REFRESH_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const LAST_CHECK_STORAGE_KEY = 'dofus-craft:catalogue-last-check';

const SNAPSHOT_URL = `${import.meta.env?.BASE_URL ?? '/'}catalogue-snapshot/`;

export function buildItemSetIndex(sets: DofusDbItemSet[], provenance: CatalogueProvenance): ItemSetIndexValue {
  const itemSetIdsByItemId = new Map<number, Set<number>>();
  sets.forEach((itemSet) => {
    itemSet.items?.forEach((item) => {
      const setIds = itemSetIdsByItemId.get(item.id) ?? new Set<number>();
      setIds.add(itemSet.id);
      itemSetIdsByItemId.set(item.id, setIds);
    });
  });
  return { sets, itemSetIdsByItemId, provenance };
}

function isMeta(value: unknown): value is SnapshotMeta {
  if (typeof value !== 'object' || value === null) return false;
  const meta = value as Partial<SnapshotMeta>;
  return meta.version === 1 && typeof meta.generatedAt === 'string' && !Number.isNaN(Date.parse(meta.generatedAt))
    && typeof meta.totals?.items === 'number' && typeof meta.totals.itemSets === 'number';
}

async function fetchJson(name: string): Promise<unknown> {
  const response = await fetch(`${SNAPSHOT_URL}${name}`, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`snapshot ${name}: ${response.status}`);
  return response.json();
}

function currentGeneratedAt(): number {
  // A copy kept by spec 021 has no provenance: older than any snapshot, so the snapshot wins once.
  const generatedAt = peekCached<CatalogueItemIndexValue>(ITEM_INDEX_KEY)?.provenance?.generatedAt;
  return generatedAt ? Date.parse(generatedAt) : 0;
}

function hasBothIndexes(): boolean {
  return peekCached(ITEM_INDEX_KEY) !== undefined && peekCached(ITEM_SET_INDEX_KEY) !== undefined;
}

function seedIndexes(items: DofusDbItem[], sets: DofusDbItemSet[], provenance: CatalogueProvenance): void {
  seedCache<CatalogueItemIndexValue>(ITEM_INDEX_KEY, { items, provenance });
  seedCache<ItemSetIndexValue>(ITEM_SET_INDEX_KEY, buildItemSetIndex(sets, provenance));
}

async function loadSnapshot(): Promise<boolean> {
  try {
    const meta = await fetchJson('meta.json');
    if (!isMeta(meta)) return hasBothIndexes();
    // The copy already on the device is at least as recent as the snapshot: nothing to download.
    if (hasBothIndexes() && currentGeneratedAt() >= Date.parse(meta.generatedAt)) return true;
    const [items, sets] = await Promise.all([fetchJson('items.json'), fetchJson('item-sets.json')]);
    if (!Array.isArray(items) || !Array.isArray(sets)
      || items.length !== meta.totals.items || sets.length !== meta.totals.itemSets) {
      return hasBothIndexes();
    }
    seedIndexes(items as DofusDbItem[], sets as DofusDbItemSet[], {
      origin: 'snapshot',
      generatedAt: meta.generatedAt,
      totals: meta.totals,
    });
    return true;
  } catch {
    // Snapshot missing or unreadable (dev server, broken delivery): whatever the device kept is used,
    // otherwise the caller falls back to the full crawl (FR-011).
    return hasBothIndexes();
  }
}

let snapshotLoad: Promise<boolean> | undefined;

/** Fills the catalogue indexes (memory + device copy) from the shipped snapshot, unless the device
 * already holds a more recent copy. Resolves to whether both indexes are now available. Runs once. */
export function loadCatalogueSnapshot(): Promise<boolean> {
  snapshotLoad ??= loadSnapshot();
  return snapshotLoad;
}

/** Test seam: forget the memoized snapshot load and the probe's session state. */
export function resetCatalogueSnapshotState(): void {
  snapshotLoad = undefined;
  probedThisSession = false;
}

let probedThisSession = false;

function probeDue(now: number): boolean {
  try {
    const last = Number(window.localStorage.getItem(LAST_CHECK_STORAGE_KEY));
    return !(last > 0) || now - last >= REFRESH_CHECK_INTERVAL_MS;
  } catch {
    // No usable storage: one probe per session.
    return !probedThisSession;
  }
}

function recordProbe(now: number): void {
  probedThisSession = true;
  try {
    window.localStorage.setItem(LAST_CHECK_STORAGE_KEY, String(now));
  } catch {
    // session flag above is enough
  }
}

/** FR-007..FR-010: compares DofusDB's totals to the catalogue in use and re-downloads only on a
 * difference. Silent on any failure; the catalogue in use is replaced only by a complete one. */
export async function refreshCatalogueIfChanged(): Promise<void> {
  try {
    const current = peekCached<CatalogueItemIndexValue>(ITEM_INDEX_KEY)?.provenance;
    if (!current) return;
    const now = Date.now();
    if (!probeDue(now)) return;
    recordProbe(now);
    const totals = await getDofusDbCatalogueTotals();
    if (totals.items === current.totals.items && totals.itemSets === current.totals.itemSets) return;
    const [items, sets] = await Promise.all([getDofusDbItems(''), getDofusDbItemSets('')]);
    if (!items.length || !sets.length) return;
    seedIndexes(items, sets, {
      origin: 'dofusdb',
      generatedAt: new Date().toISOString(),
      totals: { items: items.length, itemSets: sets.length },
    });
  } catch {
    // The next probe, or the next deployment, catches up.
  }
}
