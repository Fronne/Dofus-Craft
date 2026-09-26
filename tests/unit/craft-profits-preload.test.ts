import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const recipe = { id: 'rec', itemId: 'i1', ingredients: [{ resourceId: 'r1', quantity: 2 }] };
const catalogue = vi.hoisted(() => ({
  getItemDetail: vi.fn(),
  getResourceDetails: vi.fn(),
  whenCatalogueReady: vi.fn(() => Promise.resolve()),
}));
const listAllForServer = vi.hoisted(() => vi.fn());

vi.mock('../../src/data/catalogue-repository', () => catalogue);
vi.mock('../../src/persistence/indexeddb-pinned-item-price-repository', () => ({
  pinnedItemPrices: { listAllForServer },
}));
vi.mock('../../src/persistence/resource-prices-for-mode', () => ({
  resourcePricesFor: () => ({
    getMany: async (_serverId: string, ids: string[]) => Object.fromEntries(ids.map((id) => [id, { resourceId: id, unitPriceKamas: 100, updatedAt: '2026-09-01T00:00:00Z' }])),
    save: vi.fn(),
  }),
}));
vi.mock('../../src/features/comparison/recipe-tree-loader', () => ({
  loadRecipeTree: async () => ({ recipes: { r1: null }, resources: {} }),
}));

async function load() {
  vi.resetModules();
  return import('../../src/features/prices/useCraftProfits');
}

beforeEach(() => {
  vi.clearAllMocks();
  catalogue.whenCatalogueReady.mockImplementation(() => Promise.resolve());
  listAllForServer.mockResolvedValue([
    { itemId: 'i1', marketPriceKamas: 1000, updatedAt: '2026-09-20T00:00:00Z' },
    { itemId: 'i2', marketPriceKamas: 1000, updatedAt: '2026-09-20T00:00:00Z' },
    { itemId: 'i3', marketPriceKamas: 1000, updatedAt: '2026-09-20T00:00:00Z' },
  ]);
  catalogue.getResourceDetails.mockImplementation(async (ids: string[]) => ids.map((id) => ({ id, name: `Objet ${id}` })));
  catalogue.getItemDetail.mockImplementation(async (id: string) => ({ recipe: { ...recipe, itemId: id }, resources: [] }));
  vi.stubGlobal('requestIdleCallback', (callback: () => void) => window.setTimeout(callback, 0));
  vi.stubGlobal('cancelIdleCallback', (handle: number) => window.clearTimeout(handle));
});

describe('preloadCraftProfits (specs/021 US2)', () => {
  it('prepares the list so the page shows it without recomputing from scratch', async () => {
    const { preloadCraftProfits, useCraftProfits } = await load();
    preloadCraftProfits('s1', 'personal');
    await waitFor(() => expect(catalogue.getItemDetail).toHaveBeenCalledTimes(3));
    await new Promise((resolve) => setTimeout(resolve, 10));

    const { result } = renderHook(() => useCraftProfits('s1', 'personal'));

    expect(result.current.status).toBe('ready');
    expect(result.current.rows).toHaveLength(3);
  });

  it('gives the same rows as a direct computation', async () => {
    const direct = await load();
    const { result: directResult } = renderHook(() => direct.useCraftProfits('s1', 'personal'));
    await waitFor(() => expect(directResult.current.status).toBe('ready'));

    const preloaded = await load();
    preloaded.preloadCraftProfits('s1', 'personal');
    await new Promise((resolve) => setTimeout(resolve, 20));
    const { result } = renderHook(() => preloaded.useCraftProfits('s1', 'personal'));

    expect(result.current.rows).toEqual(directResult.current.rows);
  });

  it('joins a computation already running instead of starting a second one', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    catalogue.getItemDetail.mockImplementation(async (id: string) => {
      await gate;
      return { recipe: { ...recipe, itemId: id }, resources: [] };
    });
    const { preloadCraftProfits, useCraftProfits } = await load();
    preloadCraftProfits('s1', 'personal');
    await waitFor(() => expect(catalogue.getItemDetail).toHaveBeenCalled());

    const { result } = renderHook(() => useCraftProfits('s1', 'personal'));
    await act(async () => release());

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(listAllForServer).toHaveBeenCalledTimes(1);
    expect(catalogue.getItemDetail).toHaveBeenCalledTimes(3);
  });

  it('runs at most 2 item loads at a time in the background', async () => {
    let active = 0;
    let peak = 0;
    catalogue.getItemDetail.mockImplementation(async (id: string) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return { recipe: { ...recipe, itemId: id }, resources: [] };
    });
    listAllForServer.mockResolvedValue(Array.from({ length: 8 }, (_, index) => ({ itemId: `i${index}`, marketPriceKamas: 1000, updatedAt: '2026-09-20T00:00:00Z' })));
    const { preloadCraftProfits } = await load();

    preloadCraftProfits('s1', 'personal');
    await waitFor(() => expect(catalogue.getItemDetail).toHaveBeenCalledTimes(8));

    expect(peak).toBeLessThanOrEqual(2);
  });

  it('cancels the old context when the server changes and prepares the new one', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    catalogue.getItemDetail.mockImplementation(async (id: string) => {
      await gate;
      return { recipe: { ...recipe, itemId: id }, resources: [] };
    });
    const { preloadCraftProfits, useCraftProfits } = await load();
    preloadCraftProfits('s1', 'personal');
    await waitFor(() => expect(listAllForServer).toHaveBeenCalledWith('s1'));

    preloadCraftProfits('s2', 'personal');
    await waitFor(() => expect(listAllForServer).toHaveBeenCalledWith('s2'));
    await act(async () => release());
    await new Promise((resolve) => setTimeout(resolve, 20));

    const { result: s2 } = renderHook(() => useCraftProfits('s2', 'personal'));
    expect(s2.current.status).toBe('ready');
    const { result: s1 } = renderHook(() => useCraftProfits('s1', 'personal'));
    expect(s1.current.status).toBe('loading');
  });
});
