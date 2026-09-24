import { afterEach, describe, expect, it, vi } from 'vitest';
import { searchDofusDbItemsByName } from '../../src/services/dofusdb-api';

describe('searchDofusDbItemsByName (specs/014-admin-counters)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('searches the whole catalogue by name and returns id, name and icon', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      total: 2,
      limit: 10,
      skip: 0,
      data: [
        { id: 14094, name: { fr: 'Amulette du Strigide' }, img: 'https://api.dofusdb.fr/img/items/1235.png' },
        { id: 1, name: { fr: 'Sans icône' }, img: 'https://api.dofusdb.fr/img/items/undefined.png' },
      ],
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);

    await expect(searchDofusDbItemsByName('amulette strigide')).resolves.toEqual([
      { itemId: 14094, name: 'Amulette du Strigide', icon: 'https://api.dofusdb.fr/img/items/1235.png' },
    ]);
    const url = decodeURIComponent(String(fetchSpy.mock.calls[0][0]));
    expect(url).toContain('/items?');
    expect(url).toContain('name.fr[$regex]');
    expect(url).not.toContain('hasRecipe');
  });

  it('does not call DofusDB for an empty query', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await expect(searchDofusDbItemsByName('   ')).resolves.toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
