import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCache, peekCached, seedCache, setPersistentStore } from '../../src/data/catalogue-cache';
import {
  ITEM_INDEX_KEY,
  ITEM_SET_INDEX_KEY,
  REFRESH_CHECK_INTERVAL_MS,
  loadCatalogueSnapshot,
  refreshCatalogueIfChanged,
  resetCatalogueSnapshotState,
  type CatalogueItemIndexValue,
  type ItemSetIndexValue,
} from '../../src/data/catalogue-snapshot';
import { catalogueCache } from '../../src/persistence/indexeddb-catalogue-cache-store';
import { projectItem } from '../../scripts/build-catalogue-snapshot.mjs';
import { mapDofusDbItem } from '../../src/services/dofusdb-mappers';

const META = { version: 1, generatedAt: '2026-10-01T00:00:00.000Z', source: 'DofusDB', totals: { items: 2, itemSets: 1 } };
const ITEMS = [{ id: 1, name: { fr: 'Coiffe' }, level: 10 }, { id: 2, name: { fr: 'Cape' }, level: 20 }];
const SETS = [{ id: 7, name: { fr: 'Panoplie' }, items: [{ id: 1 }, { id: 2 }] }];

function json(body: unknown, ok = true) {
  return Promise.resolve({ ok, status: ok ? 200 : 404, json: () => Promise.resolve(body) });
}

function stubFetch(handlers: Record<string, () => Promise<unknown>>) {
  const fetchMock = vi.fn((input: string) => {
    const entry = Object.entries(handlers).find(([part]) => input.includes(part));
    return entry ? entry[1]() : json({}, false);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const snapshotHandlers = {
  'catalogue-snapshot/meta.json': () => json(META),
  'catalogue-snapshot/items.json': () => json(ITEMS),
  'catalogue-snapshot/item-sets.json': () => json(SETS),
};

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  setPersistentStore(catalogueCache);
  clearCache();
  resetCatalogueSnapshotState();
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('loadCatalogueSnapshot (specs/072, US1)', () => {
  it('fills both indexes from the snapshot without calling DofusDB', async () => {
    const fetchMock = stubFetch(snapshotHandlers);

    expect(await loadCatalogueSnapshot()).toBe(true);

    const items = peekCached<CatalogueItemIndexValue>(ITEM_INDEX_KEY);
    const sets = peekCached<ItemSetIndexValue>(ITEM_SET_INDEX_KEY);
    expect(items?.items).toHaveLength(2);
    expect(items?.provenance).toMatchObject({ origin: 'snapshot', generatedAt: META.generatedAt });
    expect(sets?.itemSetIdsByItemId.get(1)).toEqual(new Set([7]));
    expect(fetchMock.mock.calls.every(([url]) => String(url).includes('catalogue-snapshot/'))).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('rejects a snapshot whose length does not match meta.totals and falls back', async () => {
    stubFetch({ ...snapshotHandlers, 'catalogue-snapshot/items.json': () => json([ITEMS[0]]) });

    expect(await loadCatalogueSnapshot()).toBe(false);
    expect(peekCached(ITEM_INDEX_KEY)).toBeUndefined();
  });

  it('falls back when the snapshot is missing', async () => {
    stubFetch({});

    expect(await loadCatalogueSnapshot()).toBe(false);
  });

  it('keeps a kept copy that is more recent than the snapshot, and downloads only meta.json', async () => {
    seedCache<CatalogueItemIndexValue>(ITEM_INDEX_KEY, {
      items: [], provenance: { origin: 'dofusdb', generatedAt: '2026-10-20T00:00:00.000Z', totals: { items: 5, itemSets: 5 } },
    });
    seedCache(ITEM_SET_INDEX_KEY, { sets: [], itemSetIdsByItemId: new Map() });
    const fetchMock = stubFetch(snapshotHandlers);

    expect(await loadCatalogueSnapshot()).toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(peekCached<CatalogueItemIndexValue>(ITEM_INDEX_KEY)?.provenance?.origin).toBe('dofusdb');
  });

  it('replaces a copy kept by spec 021 (no provenance) or an older one with the snapshot', async () => {
    seedCache(ITEM_INDEX_KEY, { items: [] });
    seedCache(ITEM_SET_INDEX_KEY, { sets: [], itemSetIdsByItemId: new Map() });
    stubFetch(snapshotHandlers);

    await loadCatalogueSnapshot();

    expect(peekCached<CatalogueItemIndexValue>(ITEM_INDEX_KEY)?.items).toHaveLength(2);
  });

  it('keeps using the kept copy when the snapshot cannot be read', async () => {
    seedCache(ITEM_INDEX_KEY, { items: [] });
    seedCache(ITEM_SET_INDEX_KEY, { sets: [], itemSetIdsByItemId: new Map() });
    stubFetch({});

    expect(await loadCatalogueSnapshot()).toBe(true);
  });
});

describe('snapshot projection (specs/072, SC-006)', () => {
  it('maps a projected item exactly like the raw DofusDB item', () => {
    const raw = {
      id: 5,
      level: 100,
      name: { fr: 'Coiffe du Bouftou', en: 'Bouftou Hat', es: 'x' },
      img: 'https://api.dofusdb.fr/img/items/1.png',
      description: { fr: 'long texte inutile' },
      price: 12,
      type: { id: 16, superTypeId: 10, categoryId: 0, name: { fr: 'Chapeau', en: 'Hat' }, superType: { id: 10, positions: [6], name: { fr: 'Chapeau' } }, other: 1 },
      hasRecipe: true,
      itemSetId: 7,
      effects: [{ from: 1, to: 5, characteristic: 10, category: 1, elementId: -1, effectId: 118, order: 3 }],
      criteria: 'CS>100',
    };

    expect(mapDofusDbItem(projectItem(raw) as never)).toEqual(mapDofusDbItem(raw as never));
  });
});

describe('refreshCatalogueIfChanged (specs/072, US3)', () => {
  const totalsUrl = (path: string, total: number) => () => json({ total, limit: 0, skip: 0, data: [] }, true).then((r) => ({ ...r, path }));

  function seedCurrent() {
    seedCache<CatalogueItemIndexValue>(ITEM_INDEX_KEY, {
      items: ITEMS as never,
      provenance: { origin: 'snapshot', generatedAt: META.generatedAt, totals: META.totals },
    });
  }

  it('makes only the two light probes when totals are unchanged', async () => {
    seedCurrent();
    const fetchMock = stubFetch({ '/item-sets?': totalsUrl('sets', 1), '/items?': totalsUrl('items', 2) });

    await refreshCatalogueIfChanged();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every(([url]) => decodeURIComponent(String(url)).includes('$limit=0'))).toBe(true);
    expect(peekCached<CatalogueItemIndexValue>(ITEM_INDEX_KEY)?.provenance?.origin).toBe('snapshot');
  });

  it('re-downloads and replaces the indexes when a total differs', async () => {
    seedCurrent();
    const page = (data: unknown[], total: number) => () => json({ total, limit: 100, skip: 0, data });
    stubFetch({
      '$limit=0': () => json({ total: 3, limit: 0, skip: 0, data: [] }),
      '%24limit=0': () => json({ total: 3, limit: 0, skip: 0, data: [] }),
      '/items?': page([{ id: 1 }, { id: 2 }, { id: 3 }], 3),
      '/item-sets?': page([{ id: 7, items: [{ id: 3 }] }], 1),
    });

    await refreshCatalogueIfChanged();

    const items = peekCached<CatalogueItemIndexValue>(ITEM_INDEX_KEY);
    expect(items?.items).toHaveLength(3);
    expect(items?.provenance).toMatchObject({ origin: 'dofusdb', totals: { items: 3, itemSets: 3 } });
    expect(peekCached<ItemSetIndexValue>(ITEM_SET_INDEX_KEY)?.itemSetIdsByItemId.get(3)).toEqual(new Set([7]));
  });

  it('probes at most once per minimum delay', async () => {
    seedCurrent();
    const fetchMock = stubFetch({ '/item-sets?': totalsUrl('sets', 1), '/items?': totalsUrl('items', 2) });

    await refreshCatalogueIfChanged();
    await refreshCatalogueIfChanged();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + REFRESH_CHECK_INTERVAL_MS + 1000);
    await refreshCatalogueIfChanged();
    expect(fetchMock).toHaveBeenCalledTimes(4);
    vi.restoreAllMocks();
  });

  it('stays silent and keeps the catalogue when DofusDB fails', async () => {
    seedCurrent();
    stubFetch({});

    await expect(refreshCatalogueIfChanged()).resolves.toBeUndefined();
    expect(peekCached<CatalogueItemIndexValue>(ITEM_INDEX_KEY)?.items).toHaveLength(2);
  });

  it('does nothing without a catalogue in use', async () => {
    const fetchMock = stubFetch({});

    await refreshCatalogueIfChanged();

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
