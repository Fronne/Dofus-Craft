import { beforeEach, expect, it, vi } from 'vitest';
import { getItemDetail, getManifest, searchItems } from '../../src/data/catalogue-repository';
import { clearCache, setPersistentStore } from '../../src/data/catalogue-cache';

beforeEach(() => {
  clearCache();
  // specs/021: keep each test's DofusDB fixtures from leaking through the device copy.
  setPersistentStore(undefined);
  vi.stubGlobal('fetch', vi.fn().mockImplementation((input: string) => {
    const isTypesRequest = input.includes('/item-types?');
    const isItemSetsRequest = input.includes('/item-sets?');
    if (isItemSetsRequest) {
      return Promise.resolve(new Response(JSON.stringify({
        total: 0,
        limit: 100,
        skip: 0,
        data: [],
      }), { status: 200 }));
    }
    const payload = isTypesRequest
      ? {
        total: 2,
        limit: 100,
        skip: 0,
        data: [
          { id: 1, name: { fr: 'Amulette' }, superType: { id: 1, name: { fr: 'Amulette' } } },
          { id: 15, name: { fr: 'Ressource diverse' }, superType: { id: 9, name: { fr: 'Ressource' } } },
        ],
      }
      : {
        total: 1,
        limit: 24,
        skip: 0,
        data: [{
          id: 2425,
          level: 20,
          name: { fr: 'Amulette du Bouftou' },
          img: 'https://api.dofusdb.fr/img/items/1048.png',
          type: { id: 1, superType: { id: 1, name: { fr: 'Amulette' } } },
          hasRecipe: true,
        }],
      };
    return Promise.resolve(new Response(JSON.stringify(payload), { status: 200 }));
  }));
});

it('loads real-shaped DofusDB items through the catalogue repository', async () => {
  const page = await searchItems('bouftou');
  expect(page.data[0]).toMatchObject({
    id: '2425',
    name: 'Amulette du Bouftou',
    level: 20,
    kind: 'Equipment',
    categoryId: 'equipment-type-1',
  });
  expect(getManifest().sourceName).toBe('DofusDB');
});

it('loads the initial craftable results without a search query', async () => {
  await expect(searchItems('', '', 0, 12)).resolves.toMatchObject({
    total: 1,
    data: [expect.objectContaining({ id: '2425', level: 20 })],
  });
});

it('uses a targeted first search while the global catalogue index is warming up', async () => {
  const requests: string[] = [];
  vi.stubGlobal('fetch', vi.fn().mockImplementation((input: string) => {
    requests.push(input);
    if (input.includes('/item-types?')) {
      return Promise.resolve(new Response(JSON.stringify({
        total: 1,
        limit: 100,
        skip: 0,
        data: [{ id: 1, name: { fr: 'Amulette' }, superType: { id: 1, name: { fr: 'Amulette' } } }],
      }), { status: 200 }));
    }
    if (input.includes('/item-sets?')) {
      return Promise.resolve(new Response(JSON.stringify({
        total: 0,
        limit: 50,
        skip: 0,
        data: [],
      }), { status: 200 }));
    }
    if (input.includes('/items?') && input.includes('name.fr%5B%24regex%5D')) {
      return Promise.resolve(new Response(JSON.stringify({
        total: 1,
        limit: 100,
        skip: 0,
        data: [{
          id: 2425,
          level: 20,
          name: { fr: 'Amulette de Fosse' },
          type: { id: 1, superType: { id: 1 } },
          hasRecipe: true,
        }],
      }), { status: 200 }));
    }
    return Promise.resolve(new Response(JSON.stringify({
      total: 0,
      limit: 100,
      skip: 0,
      data: [],
    }), { status: 200 }));
  }));

  await expect(searchItems('fosse')).resolves.toMatchObject({
    total: 1,
    data: [{ id: '2425', name: 'Amulette de Fosse' }],
  });
  expect(requests.some((request) => request.includes('name.fr%5B%24regex%5D'))).toBe(true);
  expect(requests.some((request) => request.includes('hasRecipe=true') && !request.includes('name.fr%5B%24regex%5D'))).toBe(false);
});

it('fetches only the selected category instead of the whole catalogue when no search query is given', async () => {
  const requests: string[] = [];
  vi.stubGlobal('fetch', vi.fn().mockImplementation((input: string) => {
    requests.push(input);
    if (input.includes('/item-types?')) {
      return Promise.resolve(new Response(JSON.stringify({
        total: 1,
        limit: 100,
        skip: 0,
        data: [{ id: 1, name: { fr: 'Amulette' }, superType: { id: 1, name: { fr: 'Amulette' } } }],
      }), { status: 200 }));
    }
    if (input.includes('/item-sets?')) {
      return Promise.resolve(new Response(JSON.stringify({ total: 0, limit: 50, skip: 0, data: [] }), { status: 200 }));
    }
    if (input.includes('/items?') && input.includes('typeId=1')) {
      return Promise.resolve(new Response(JSON.stringify({
        total: 1,
        limit: 100,
        skip: 0,
        data: [{
          id: 2425,
          level: 20,
          name: { fr: 'Amulette du Bouftou' },
          type: { id: 1, superType: { id: 1 } },
          hasRecipe: true,
        }],
      }), { status: 200 }));
    }
    return Promise.resolve(new Response(JSON.stringify({ total: 0, limit: 100, skip: 0, data: [] }), { status: 200 }));
  }));

  await expect(searchItems('', 'equipment-type-1', 0, 12)).resolves.toMatchObject({
    total: 1,
    data: [{ id: '2425', name: 'Amulette du Bouftou' }],
  });
  expect(requests.some((request) => request.includes('/items?') && request.includes('typeId=1'))).toBe(true);
  expect(requests.some((request) => request.includes('/items?') && !request.includes('typeId='))).toBe(false);
});

it('sorts by level then name before applying the result limit', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((input: string) => {
    if (input.includes('/item-types?')) {
      return Promise.resolve(new Response(JSON.stringify({
        total: 1,
        limit: 100,
        skip: 0,
        data: [{ id: 1, name: { fr: 'Amulette' }, superType: { id: 1, name: { fr: 'Amulette' } } }],
      }), { status: 200 }));
    }
    if (input.includes('/items?')) {
      return Promise.resolve(new Response(JSON.stringify({
        total: 4,
        limit: 100,
        skip: 0,
        data: [
          { id: 4, level: 100, name: { fr: 'Item Zénith' }, type: { id: 1, superType: { id: 1 } }, hasRecipe: true },
          { id: 1, level: 1, name: { fr: 'Item Bêta' }, type: { id: 1, superType: { id: 1 } }, hasRecipe: true },
          { id: 3, level: 20, name: { fr: 'Item Alpha' }, type: { id: 1, superType: { id: 1 } }, hasRecipe: true },
          { id: 2, level: 1, name: { fr: 'Item Alpha' }, type: { id: 1, superType: { id: 1 } }, hasRecipe: true },
        ],
      }), { status: 200 }));
    }
    return Promise.resolve(new Response(JSON.stringify({
      total: 4,
      limit: 100,
      skip: 0,
      data: [
        { id: 4, level: 100, name: { fr: 'Item Zénith' }, type: { id: 1, superType: { id: 1 } }, hasRecipe: true },
        { id: 1, level: 1, name: { fr: 'Item Bêta' }, type: { id: 1, superType: { id: 1 } }, hasRecipe: true },
        { id: 3, level: 20, name: { fr: 'Item Alpha' }, type: { id: 1, superType: { id: 1 } }, hasRecipe: true },
        { id: 2, level: 1, name: { fr: 'Item Alpha' }, type: { id: 1, superType: { id: 1 } }, hasRecipe: true },
      ],
    }), { status: 200 }));
  }));

  await expect(searchItems('item', '', 0, 2)).resolves.toMatchObject({
    total: 4,
    data: [
      { id: '2', name: 'Item Alpha', level: 1 },
      { id: '1', name: 'Item Bêta', level: 1 },
    ],
  });
});

it('excludes items without an exploitable recipe before sorting and limiting', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((input: string) => {
    if (input.includes('/item-types?')) {
      return Promise.resolve(new Response(JSON.stringify({
        total: 1,
        limit: 100,
        skip: 0,
        data: [{ id: 1, name: { fr: 'Amulette' }, superType: { id: 1, name: { fr: 'Amulette' } } }],
      }), { status: 200 }));
    }
    if (input.includes('/items?')) {
      return Promise.resolve(new Response(JSON.stringify({
        total: 3,
        limit: 100,
        skip: 0,
        data: [
          { id: 1, level: 1, name: { fr: 'Craftable sans recette' }, type: { id: 1, superType: { id: 1 } }, hasRecipe: false },
          { id: 2, level: 20, name: { fr: 'Craftable valide' }, type: { id: 1, superType: { id: 1 } }, hasRecipe: true },
          { id: 3, level: 30, name: { fr: 'Craftable valide 2' }, type: { id: 1, superType: { id: 1 } }, hasRecipe: true },
        ],
      }), { status: 200 }));
    }
    return Promise.resolve(new Response(JSON.stringify({ total: 0, limit: 100, skip: 0, data: [] }), { status: 200 }));
  }));

  await expect(searchItems('craftable', '', 0, 12)).resolves.toMatchObject({
    total: 2,
    data: [
      { id: '2', name: 'Craftable valide' },
      { id: '3', name: 'Craftable valide 2' },
    ],
  });
});

it('matches multiple partial words without accents', async () => {
  const page = await searchItems('amu bouftou');
  expect(page.data.map((item) => item.name)).toEqual(['Amulette du Bouftou']);
});

it('returns the exact DofusDB panoplie name from the item relation', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((input: string) => {
    if (input.includes('/items/19994')) {
      return Promise.resolve(new Response(JSON.stringify({
        id: 19994,
        name: { fr: 'Amulette du Strigide' },
        itemSetId: 274,
        hasRecipe: true,
        type: { id: 1, superType: { id: 1 } },
      }), { status: 200 }));
    }
    if (input.includes('/item-sets/274')) {
      return Promise.resolve(new Response(JSON.stringify({
        id: 274,
        name: { fr: 'Panoplie du Strigide' },
        items: [],
      }), { status: 200 }));
    }
    return Promise.resolve(new Response(JSON.stringify({
      total: 0,
      limit: 10,
      skip: 0,
      data: [],
    }), { status: 200 }));
  }));

  await expect(getItemDetail('19994')).resolves.toMatchObject({
    panoplieName: 'Panoplie du Strigide',
  });
});

it('loads a recipe when DofusDB marks the item as having no panoplie', async () => {
  const fetchMock = vi.fn().mockImplementation((input: string) => {
    if (input.includes('/items/19995')) {
      return Promise.resolve(new Response(JSON.stringify({
        id: 19995,
        name: { fr: 'Objet sans panoplie' },
        itemSetId: -1,
        hasRecipe: true,
        type: { id: 1, superType: { id: 1 } },
      }), { status: 200 }));
    }
    if (input.includes('/recipes?')) {
      return Promise.resolve(new Response(JSON.stringify({
        total: 1,
        limit: 10,
        skip: 0,
        data: [{
          id: 19995,
          resultId: 19995,
          ingredientIds: [286],
          quantities: [2],
          ingredients: [{ id: 286, name: { fr: 'Levure de Boulanger' } }],
        }],
      }), { status: 200 }));
    }
    return Promise.resolve(new Response(JSON.stringify({
      total: 0,
      limit: 10,
      skip: 0,
      data: [],
    }), { status: 200 }));
  });
  vi.stubGlobal('fetch', fetchMock);

  await expect(getItemDetail('19995')).resolves.toMatchObject({
    recipe: {
      ingredients: [{ resourceId: '286', quantity: 2 }],
    },
    resources: [{ id: '286', name: 'Levure de Boulanger' }],
  });
  expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/item-sets/-1'), expect.anything());
});

it('keeps a crafted trophy ingredient available in the recipe detail', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((input: string) => {
    if (input.includes('/items/15001')) {
      return Promise.resolve(new Response(JSON.stringify({
        id: 15001,
        name: { fr: 'Trophée de test' },
        level: 100,
        effects: [{ effectId: 125, from: 10, to: 20 }],
      }), { status: 200 }));
    }
    if (input.includes('/recipes?')) {
      return Promise.resolve(new Response(JSON.stringify({
        total: 1,
        limit: 10,
        skip: 0,
        data: [{
          id: 15000,
          resultId: 15001,
          ingredientIds: [12713, 384],
          quantities: [1, 2],
          ingredients: [
            {
              id: 12713,
              name: { fr: 'Acrobate' },
              img: 'https://api.dofusdb.fr/img/items/151002.png',
              type: { id: 151, categoryId: 0, superTypeId: 13 },
            },
            {
              id: 384,
              name: { fr: 'Laine de Bouftou' },
              img: 'https://api.dofusdb.fr/img/items/15010.png',
              type: { id: 15, categoryId: 2, superTypeId: 9 },
            },
          ],
        }],
      }), { status: 200 }));
    }
    if (input.includes('/effects?')) {
      return Promise.resolve(new Response(JSON.stringify({
        total: 1,
        limit: 1,
        skip: 0,
        data: [{ id: 125, description: { fr: '#1{{~1~2 à }}#2 Vitalité' } }],
      }), { status: 200 }));
    }
    return Promise.resolve(new Response(JSON.stringify({
      total: 0,
      limit: 100,
      skip: 0,
      data: [],
    }), { status: 200 }));
  }));

  await expect(getItemDetail('15001')).resolves.toMatchObject({
    recipe: {
      ingredients: [
        { resourceId: '12713', quantity: 1 },
        { resourceId: '384', quantity: 2 },
      ],
    },
    resources: [
      { id: '12713', name: 'Acrobate', imageUrl: 'https://api.dofusdb.fr/img/items/151002.png' },
      { id: '384', name: 'Laine de Bouftou', imageUrl: 'https://api.dofusdb.fr/img/items/15010.png' },
    ],
    stats: [{ label: '10 à 20 Vitalité' }],
  });
});

it('cleans technical effect markers and collapses binary PA, PM, PO and invocation bonuses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input: string) => {
      if (input.includes('/items/16001')) {
        return Promise.resolve(new Response(JSON.stringify({
          id: 16001,
          name: { fr: 'Objet aux effets variés' },
          level: 200,
          effects: [
            { effectId: 418, from: 16, to: 20 },
            { effectId: 111, from: 1, to: 0, characteristic: 1 },
            { effectId: 77, from: 0, to: 1, characteristic: 19 },
            { effectId: 117, from: 1, to: 0, characteristic: 19 },
            { effectId: 116, from: 1, to: 0, characteristic: 26 },
            { effectId: 118, from: 20, to: 0, characteristic: 10 },
            { effectId: 125, from: 20, to: 0, characteristic: 11 },
            { effectId: 125, from: 20, to: 30, characteristic: 11 },
            { effectId: 421, from: -16, to: -20, characteristic: 87 },
          ],
        }), { status: 200 }));
      }
      if (input.includes('/effects?')) {
        const id = Number(new URL(input).searchParams.get('id'));
        const descriptions: Record<number, string> = {
          418: '#1{{~1~2 à }}#2 Dommage{{~ps}}{{~zs}} Critiques',
          111: '#1{{~1~2 à }}#2 PA',
          77: '#1{{~1~2 à }}#2 PM',
          117: '#1{{~1~2 à }}#2 PO',
          116: '#1{{~1~2 à }}#2 Invocation',
          118: '#1{{~1~2 à }}#2 Force',
          125: '#1{{~1~2 à }}#2 Vitalité',
          421: '-#1{{~1~2 à -}}#2 Résistance{{~ps}}{{~zs}} Critiques',
        };
        return Promise.resolve(new Response(JSON.stringify({
          total: 1,
          limit: 1,
          skip: 0,
          data: [{ id, description: { fr: descriptions[id] } }],
        }), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify({
        total: 0,
        limit: 100,
        skip: 0,
        data: [],
      }), { status: 200 }));
    }));

    await expect(getItemDetail('16001')).resolves.toMatchObject({
      stats: [
        { label: '16 à 20 Dommage Critiques' },
        { label: '1 PA' },
        { label: '1 PM' },
        { label: '1 PO' },
        { label: '1 Invocation' },
        { label: '20 Force' },
        { label: '20 Vitalité' },
        { label: '20 à 30 Vitalité' },
        { label: '-16 à -20 Résistance Critiques' },
      ],
    });
});

it('flags weapon damage/steal effects as isWeaponEffect and other bonuses as not', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((input: string) => {
    if (input.includes('/items/16002')) {
      return Promise.resolve(new Response(JSON.stringify({
        id: 16002,
        name: { fr: 'Arme de test' },
        level: 200,
        effects: [
          { effectId: 96, from: 16, to: 20, category: 2, elementId: 3 },
          { effectId: 125, from: 351, to: 400, category: 0, characteristic: 11 },
        ],
      }), { status: 200 }));
    }
    if (input.includes('/effects?')) {
      const id = Number(new URL(input).searchParams.get('id'));
      const descriptions: Record<number, string> = {
        96: '#1{{~1~2 à }}#2 dommages Eau',
        125: '#1{{~1~2 à }}#2 Vitalité',
      };
      return Promise.resolve(new Response(JSON.stringify({
        total: 1,
        limit: 1,
        skip: 0,
        data: [{ id, description: { fr: descriptions[id] } }],
      }), { status: 200 }));
    }
    return Promise.resolve(new Response(JSON.stringify({
      total: 0,
      limit: 100,
      skip: 0,
      data: [],
    }), { status: 200 }));
  }));

  await expect(getItemDetail('16002')).resolves.toMatchObject({
    stats: [
      { label: '16 à 20 dommages Eau', isWeaponEffect: true },
      { label: '351 à 400 Vitalité', isWeaponEffect: false },
    ],
  });
});

it('shows the generic "Dommage" icon for a "dommages/vol du meilleur élément" effect (no fixed element)', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((input: string) => {
    if (input.includes('/items/16003')) {
      return Promise.resolve(new Response(JSON.stringify({
        id: 16003,
        name: { fr: 'Crocobur' },
        level: 200,
        effects: [{ effectId: 2822, from: 41, to: 60, category: 2, elementId: -1 }],
      }), { status: 200 }));
    }
    if (input.includes('/effects?')) {
      return Promise.resolve(new Response(JSON.stringify({
        total: 1,
        limit: 1,
        skip: 0,
        data: [{ id: 2822, characteristic: 0, elementId: -1, description: { fr: '#1{{~1~2 à }}#2 dommages du meilleur élément' } }],
      }), { status: 200 }));
    }
    return Promise.resolve(new Response(JSON.stringify({
      total: 0,
      limit: 100,
      skip: 0,
      data: [],
    }), { status: 200 }));
  }));

  await expect(getItemDetail('16003')).resolves.toMatchObject({
    stats: [{ label: '41 à 60 dommages du meilleur élément', icon: 'tx_damage', isWeaponEffect: true }],
  });
});

it('flags an item as a weapon based on its DofusDB super-type', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((input: string) => {
    if (input.includes('/items/30949')) {
      return Promise.resolve(new Response(JSON.stringify({
        id: 30949,
        name: { fr: 'Masse Étacée' },
        type: { id: 7, superType: { id: 2 } },
      }), { status: 200 }));
    }
    return Promise.resolve(new Response(JSON.stringify({
      total: 0,
      limit: 100,
      skip: 0,
      data: [],
    }), { status: 200 }));
  }));

  await expect(getItemDetail('30949')).resolves.toMatchObject({ isWeapon: true });
});

it('does not flag a non-weapon item as a weapon', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((input: string) => {
    if (input.includes('/items/19994')) {
      return Promise.resolve(new Response(JSON.stringify({
        id: 19994,
        name: { fr: 'Amulette du Strigide' },
        type: { id: 1, superType: { id: 1 } },
      }), { status: 200 }));
    }
    return Promise.resolve(new Response(JSON.stringify({
      total: 0,
      limit: 100,
      skip: 0,
      data: [],
    }), { status: 200 }));
  }));

  await expect(getItemDetail('19994')).resolves.toMatchObject({ isWeapon: false });
});

it('finds craftable equipment through its DofusDB item set relation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input: string) => {
      if (input.includes('/items/14094')) {
        return Promise.resolve(new Response(JSON.stringify({
          id: 14094,
          name: { fr: 'Amulette du Strigide' },
          level: 200,
          hasRecipe: true,
          type: { id: 1, superType: { id: 1 } },
        }), { status: 200 }));
      }
      if (input.includes('/items/14095')) {
        return Promise.resolve(new Response(JSON.stringify({
          id: 14095,
          name: { fr: 'Ceinture du Strigide' },
          level: 200,
          hasRecipe: true,
          type: { id: 2, superType: { id: 2 } },
        }), { status: 200 }));
      }
      if (input.includes('/items/15094') || input.includes('/items/16094')) {
        const id = input.includes('/items/15094') ? 15094 : 16094;
        return Promise.resolve(new Response(JSON.stringify({
          id,
          name: { fr: id === 15094 ? 'Amulette Volkorne' : 'Anneau de l’Égaré' },
          level: id === 15094 ? 180 : 120,
          hasRecipe: true,
          type: { id: 1, superType: { id: 1 } },
        }), { status: 200 }));
      }
      if (input.includes('/item-types?')) {
        return Promise.resolve(new Response(JSON.stringify({
          total: 1,
          limit: 100,
          skip: 0,
          data: [{ id: 1, name: { fr: 'Anneau' }, superType: { id: 1, name: { fr: 'Anneau' } } }],
        }), { status: 200 }));
      }
      if (input.includes('/item-sets?')) {
        return Promise.resolve(new Response(JSON.stringify({
          total: 1,
          limit: 100,
          skip: 0,
          data: [{
            id: 274,
            name: { fr: 'Panoplie du Strigide' },
            items: [
              { id: 14094, name: { fr: 'Amulette du Strigide' }, level: 200, hasRecipe: true, type: { id: 1, superType: { id: 1 } } },
              { id: 14095, name: { fr: 'Ceinture du Strigide' }, level: 200, hasRecipe: true, type: { id: 2, superType: { id: 2 } } },
              { id: 14096, name: { fr: 'Bottes du Strigide' }, level: 200, hasRecipe: false, type: { id: 3, superType: { id: 3 } } },
            ],
          }, {
            id: 275,
            name: { fr: 'Panoplie Volkorne' },
            items: [
              { id: 15094, name: { fr: 'Amulette Volkorne' }, level: 180, hasRecipe: true, type: { id: 1, superType: { id: 1 } } },
            ],
          }, {
            id: 276,
            name: { fr: 'Panoplie de l’Égaré' },
            items: [
              { id: 16094, name: { fr: 'Anneau de l’Égaré' }, level: 120, hasRecipe: true, type: { id: 1, superType: { id: 1 } } },
            ],
          }],
        }), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify({
        total: 0,
        limit: 100,
        skip: 0,
        data: [],
      }), { status: 200 }));
    }));

    await expect(searchItems('strigide')).resolves.toMatchObject({
      data: [
        expect.objectContaining({ id: '14094', name: 'Amulette du Strigide' }),
        expect.objectContaining({ id: '14095', name: 'Ceinture du Strigide' }),
      ],
      total: 2,
    });
    await expect(searchItems('strigide', 'equipment-type-1')).resolves.toMatchObject({
      data: [expect.objectContaining({ id: '14094' })],
      total: 1,
    });
    await expect(searchItems('strigide', '', 0, 24, undefined, '200+')).resolves.toMatchObject({
      data: [expect.objectContaining({ id: '14094' }), expect.objectContaining({ id: '14095' })],
  });
    await expect(searchItems('Volkorne')).resolves.toMatchObject({
      data: [expect.objectContaining({ id: '15094', name: 'Amulette Volkorne' })],
    });
    await expect(searchItems('strig')).resolves.toMatchObject({
      data: [
        expect.objectContaining({ id: '14094' }),
        expect.objectContaining({ id: '14095' }),
      ],
    });
    await expect(searchItems('egare')).resolves.toMatchObject({
      data: [expect.objectContaining({ id: '16094', name: 'Anneau de l’Égaré' })],
    });
});

it('finds the craftable items of the DofusDB Fosse set', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input: string) => {
      if (input.includes('/item-types?')) {
        return Promise.resolve(new Response(JSON.stringify({
          total: 1,
          limit: 100,
          skip: 0,
          data: [{ id: 1, name: { fr: 'Amulette' }, superType: { id: 1, name: { fr: 'Amulette' } } }],
        }), { status: 200 }));
      }
      if (input.includes('/items/18004')) {
        return Promise.resolve(new Response(JSON.stringify({
          id: 18004,
          name: { fr: 'Amulette de Shokkoth' },
          level: 200,
          hasRecipe: true,
          itemSetId: 958,
          type: { id: 1, superType: { id: 1 } },
        }), { status: 200 }));
      }
      if (input.includes('/items/18005') || input.includes('/items/18017')) {
        const id = input.includes('/items/18005') ? 18005 : 18017;
        return Promise.resolve(new Response(JSON.stringify({
          id,
          name: { fr: id === 18005 ? 'Cape de Mantaze' : 'Dagoulinantes' },
          level: 200,
          hasRecipe: true,
          itemSetId: 958,
          type: { id: id === 18005 ? 17 : 5, superType: { id: id === 18005 ? 2 : 1 } },
        }), { status: 200 }));
      }
      if (input.includes('/item-sets?')) {
        return Promise.resolve(new Response(JSON.stringify({
          total: 1,
          limit: 50,
          skip: 0,
          data: [{
            id: 958,
            name: { fr: 'Panoplie de la Fosse' },
            items: [
              { id: 18004, name: { fr: 'Amulette de Shokkoth' }, hasRecipe: true },
              { id: 18005, name: { fr: 'Cape de Mantaze' }, hasRecipe: true },
              { id: 18017, name: { fr: 'Dagoulinantes' }, hasRecipe: true },
            ],
          }],
        }), { status: 200 }));
      }
      return Promise.resolve(new Response(JSON.stringify({
        total: 0,
        limit: 100,
        skip: 0,
        data: [],
      }), { status: 200 }));
    }));

    await expect(searchItems('fosse')).resolves.toMatchObject({
      total: 3,
      data: [
        expect.objectContaining({ id: '18004', name: 'Amulette de Shokkoth' }),
        expect.objectContaining({ id: '18005', name: 'Cape de Mantaze' }),
        expect.objectContaining({ id: '18017', name: 'Dagoulinantes' }),
      ],
    });
});

it('does not expose the non-craftable Cire Momore apparat set', async () => {
      vi.stubGlobal('fetch', vi.fn().mockImplementation((input: string) => {
        if (input.includes('/item-types?')) {
          return Promise.resolve(new Response(JSON.stringify({
            total: 1,
            limit: 100,
            skip: 0,
            data: [{ id: 1, name: { fr: 'Amulette' }, superType: { id: 1, name: { fr: 'Amulette' } } }],
          }), { status: 200 }));
        }
        if (input.includes('/item-sets?')) {
          return Promise.resolve(new Response(JSON.stringify({
            total: 1,
            limit: 50,
            skip: 0,
            data: [{
              id: 781,
              name: { fr: "Panoplie d'apparat de Cire Momore" },
              items: [
                { id: 27371, name: 'Cuirasse de Cire Momore', hasRecipe: false },
                { id: 27637, name: 'Main de Cire', hasRecipe: false },
                { id: 27722, name: 'Croum de Cire', hasRecipe: false },
                { id: 27723, name: 'Crouroullié de Cire', hasRecipe: false },
              ],
            }],
          }), { status: 200 }));
        }
        return Promise.resolve(new Response(JSON.stringify({
          total: 0,
          limit: 100,
          skip: 0,
          data: [],
        }), { status: 200 }));
      }));

      await expect(searchItems('cire momore')).resolves.toMatchObject({
        total: 0,
        data: [],
      });
      await expect(searchItems('momore')).resolves.toMatchObject({
        total: 0,
        data: [],
    });
});
