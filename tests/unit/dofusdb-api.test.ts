import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DofusDbError,
  getDofusDbInitialItems,
  getDofusDbItemTypes,
  getDofusDbItems,
  getDofusDbItemSets,
  getDofusDbItemsByTypeIds,
  normalizeSearchText,
  searchDofusDbItems,
} from '../../src/services/dofusdb-api';

describe('DofusDB API service', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('validates paginated item responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      total: 1,
      limit: 24,
      skip: 0,
      data: [{ id: 1, name: { fr: 'Épée' } }],
    }), { status: 200 })));

    await expect(searchDofusDbItems('épée')).resolves.toMatchObject({ total: 1 });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('name.fr%5B%24regex%5D=%5Be'),
      expect.objectContaining({ signal: undefined }),
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('hasRecipe=true'),
      expect.objectContaining({ signal: undefined }),
    );
  });

  it('makes unaccented search case-insensitive for plain letters', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      total: 1,
      limit: 100,
      skip: 0,
      data: [{ id: 1, name: { fr: 'Amulette du Strigide' } }],
    }), { status: 200 })));

    await expect(searchDofusDbItems('strigide', 1, 0, 100)).resolves.toMatchObject({ total: 1 });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('name.fr%5B%24regex%5D=%5BsS%5D'),
      expect.objectContaining({ signal: undefined }),
    );
  });

  it('loads item sets with accent-insensitive name filtering', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      total: 1,
      limit: 100,
      skip: 0,
      data: [{ id: 274, name: { fr: 'Panoplie du Strigide' }, items: [] }],
    }), { status: 200 })));

    await expect(getDofusDbItemSets('strigide')).resolves.toEqual([
      expect.objectContaining({ id: 274, name: { fr: 'Panoplie du Strigide' } }),
    ]);
  });

  it('normalizes partial and accentless search terms', () => {
    expect(normalizeSearchText('  Marteau des Égarés  ')).toBe('marteau des égarés'.normalize('NFD').replace(/\p{Diacritic}/gu, ''));
    expect(normalizeSearchText('ÉPÉE')).toBe('epee');
  });

  it('rejects malformed responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    await expect(searchDofusDbItems('')).rejects.toBeInstanceOf(DofusDbError);
  });

  it('loads all item type metadata pages', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        total: 101,
        limit: 100,
        skip: 0,
        data: Array.from({ length: 100 }, (_, id) => ({ id, superTypeId: 2 })),
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        total: 101,
        limit: 100,
        skip: 100,
        data: [{ id: 100, superTypeId: 7 }],
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getDofusDbItemTypes()).resolves.toHaveLength(101);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('loads every item page and removes duplicate ids across types', async () => {
    const fetchMock = vi.fn().mockImplementation((input: string) => {
      const url = new URL(input);
      const skip = Number(url.searchParams.get('$skip'));
      const typeId = Number(url.searchParams.get('typeId'));
      const data = typeId === 1
        ? skip === 0
          ? [{ id: 1, name: { fr: 'Amulette ancienne' } }]
          : [{ id: 3, name: { fr: 'Amulette Strigide' } }]
        : [{ id: 3, name: { fr: 'Amulette Strigide' } }];
      return Promise.resolve(new Response(JSON.stringify({
        total: typeId === 1 && skip === 0 ? 2 : 1,
        limit: 100,
        skip,
        data,
      }), { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const items = await getDofusDbItemsByTypeIds('', [1, 2]);
    expect(items.map((item) => item.id)).toEqual([1, 3]);
  });

  it('loads paginated recipe-bearing items without requesting each type separately', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        total: 2,
        limit: 100,
        skip: 0,
        data: [{ id: 1, name: { fr: 'Amulette' } }, { id: 2, name: { fr: 'Anneau' } }],
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getDofusDbItems('strigide')).resolves.toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('hasRecipe=true');
    expect(fetchMock.mock.calls[0][0]).not.toContain('typeId=');
  });

  it('loads a lightweight initial page sorted by level', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      total: 100,
      limit: 100,
      skip: 0,
      data: [{ id: 1, level: 1, name: { fr: 'Objet' } }],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getDofusDbInitialItems()).resolves.toHaveLength(1);
    const requestUrl = new URL(fetchMock.mock.calls[0][0]);
    expect(requestUrl.searchParams.get('$sort')).toBe('level');
    expect(requestUrl.searchParams.get('$limit')).toBe('100');
  });
});
