import { describe, expect, it } from 'vitest';
import { getDofusDbItemKind, mapDofusDbCategories, mapDofusDbItem, mapDofusDbResource, mapDofusDbServers } from '../../src/services/dofusdb-mappers';

const equipment = {
  id: 2425,
  level: 20,
  name: { fr: 'Amulette du Bouftou' },
  type: { id: 1, categoryId: 0, superType: { id: 1, positions: [0], name: { fr: 'Amulette' } } },
};

const resource = {
  id: 384,
  level: 19,
  name: { fr: 'Laine de Bouftou' },
  type: { id: 15, categoryId: 2, superType: { id: 9, positions: [], name: { fr: 'Ressource' } } },
};

describe('DofusDB catalogue classification', () => {
  it('groups every DofusDB weapon type under the Arme category', () => {
    const categories = mapDofusDbCategories([
      { id: 2, categoryId: 0, name: { fr: 'Arc' }, superType: { id: 2, positions: [1], name: { fr: 'Arme' } } },
      { id: 3, categoryId: 0, name: { fr: 'Baguette' }, superType: { id: 2, positions: [1], name: { fr: 'Arme' } } },
      { id: 4, categoryId: 0, name: { fr: 'Bâton' }, superType: { id: 2, positions: [1], name: { fr: 'Arme' } } },
      { id: 5, categoryId: 0, name: { fr: 'Dague' }, superType: { id: 2, positions: [1], name: { fr: 'Arme' } } },
      { id: 6, categoryId: 0, name: { fr: 'Épée' }, superType: { id: 2, positions: [1], name: { fr: 'Arme' } } },
      { id: 7, categoryId: 0, name: { fr: 'Marteau' }, superType: { id: 2, positions: [1], name: { fr: 'Arme' } } },
      { id: 8, categoryId: 0, name: { fr: 'Pelle' }, superType: { id: 2, positions: [1], name: { fr: 'Arme' } } },
      { id: 19, categoryId: 0, name: { fr: 'Hache' }, superType: { id: 2, positions: [1], name: { fr: 'Arme' } } },
      { id: 20, categoryId: 0, name: { fr: 'Outil' }, superType: { id: 2, positions: [1], name: { fr: 'Arme' } } },
      { id: 21, categoryId: 0, name: { fr: 'Pioche' }, superType: { id: 2, positions: [1], name: { fr: 'Arme' } } },
      { id: 22, categoryId: 0, name: { fr: 'Faux' }, superType: { id: 2, positions: [1], name: { fr: 'Arme' } } },
      { id: 114, categoryId: 0, name: { fr: 'Arme magique' }, superType: { id: 2, positions: [1], name: { fr: 'Arme' } } },
      { id: 271, categoryId: 0, name: { fr: 'Lance' }, superType: { id: 2, positions: [1], name: { fr: 'Arme' } } },
    ]);

    expect(categories).toEqual([
      expect.objectContaining({
        id: 'equipment-type-2',
        label: 'Arme',
        typeIds: [2, 3, 4, 5, 6, 7, 8, 19, 20, 21, 22, 114, 271],
      }),
    ]);
  });

  it('uses each real DofusDB super type for equipment categories', () => {
    const categories = mapDofusDbCategories([
      { id: 1, categoryId: 0, name: { fr: 'Amulette' }, superType: { id: 1, positions: [0], name: { fr: 'Amulette' } } },
      { id: 9, categoryId: 0, name: { fr: 'Anneau' }, superType: { id: 3, positions: [2, 4], name: { fr: 'Anneau' } } },
      { id: 82, categoryId: 0, name: { fr: 'Bouclier' }, superType: { id: 7, positions: [15], name: { fr: 'Bouclier' } } },
    ]);

    expect(categories.map(({ id, typeIds }) => ({ id, typeIds }))).toEqual([
      { id: 'equipment-type-1', typeIds: [1] },
      { id: 'equipment-type-3', typeIds: [9] },
      { id: 'equipment-type-7', typeIds: [82] },
    ]);
  });

  it('excludes Dofus while merging trophies and prysmaradites into one Trophée category', () => {
    const types = [
      { id: 23, categoryId: 0, name: { fr: 'Dofus' }, superType: { id: 13, positions: [9], name: { fr: 'Dofus / Trophée / Prysmaradite' } } },
      { id: 151, categoryId: 0, name: { fr: 'Trophée' }, superType: { id: 13, positions: [9], name: { fr: 'Dofus / Trophée / Prysmaradite' } } },
      { id: 217, categoryId: 0, name: { fr: 'Prysmaradite' }, superType: { id: 13, positions: [9], name: { fr: 'Dofus / Trophée / Prysmaradite' } } },
    ];

    expect(mapDofusDbCategories(types).map(({ id, label, typeIds }) => ({ id, label, typeIds }))).toEqual([
      { id: 'equipment-type-151', label: 'Trophée', typeIds: [151, 217] },
    ]);
    expect(getDofusDbItemKind({
      id: 7754,
      name: { fr: 'Dofus Ocre' },
      type: { id: 23, categoryId: 0, superTypeId: 13 },
    })).toBeUndefined();
    expect(mapDofusDbItem({
      id: 12713,
      name: { fr: 'Acrobate' },
      type: { id: 151, categoryId: 0, superTypeId: 13 },
    })).toMatchObject({ kind: 'Equipment', categoryId: 'equipment-type-151' });
    expect(mapDofusDbItem({
      id: 12714,
      name: { fr: 'Prysmaradite de test' },
      type: { id: 217, categoryId: 0, superTypeId: 13 },
    })).toMatchObject({ kind: 'Equipment', categoryId: 'equipment-type-151' });
  });

  it('classifies equipment using the DofusDB super-type fields', () => {
    expect(getDofusDbItemKind(equipment)).toBe('Equipment');
    expect(mapDofusDbItem(equipment)).toMatchObject({
      kind: 'Equipment',
      categoryId: 'equipment-type-1',
    });
  });

  it('classifies resources using the DofusDB resource super-type', () => {
    expect(getDofusDbItemKind(resource)).toBe('Resource');
    expect(mapDofusDbItem(resource)).toMatchObject({
      kind: 'Resource',
      categoryId: 'resource',
    });
  });

  it('keeps resource images when mapping recipe ingredients', () => {
    expect(mapDofusDbItem({
      ...resource,
      img: 'https://api.dofusdb.fr/img/items/384.png',
    })).toMatchObject({
      id: '384',
      imageUrl: 'https://api.dofusdb.fr/img/items/384.png',
    });
  });

  it('maps equipment used as a recipe ingredient without exposing it as a resource category', () => {
    expect(mapDofusDbResource({
      id: 12712,
      name: { fr: 'Acrobate mineur' },
      img: 'https://api.dofusdb.fr/img/items/151001.png',
      type: { id: 151, categoryId: 0, superType: { id: 13, positions: [9], name: { fr: 'Dofus / Trophée / Prysmaradite' } } },
    })).toEqual({
      id: '12712',
      name: 'Acrobate mineur',
      imageUrl: 'https://api.dofusdb.fr/img/items/151001.png',
    });
  });

  it('maps a crafted trophy ingredient as a recipe resource', () => {
    expect(mapDofusDbResource({
      id: 12713,
      level: 100,
      name: { fr: 'Acrobate' },
      img: 'https://api.dofusdb.fr/img/items/151002.png',
      type: {
        id: 151,
        categoryId: 0,
        superTypeId: 13,
        superType: {
          id: 13,
          positions: [9, 10, 11, 12, 13, 14],
          name: { fr: 'Dofus / Trophée / Prysmaradite' },
        },
      },
    })).toEqual({
      id: '12713',
      name: 'Acrobate',
      imageUrl: 'https://api.dofusdb.fr/img/items/151002.png',
    });
  });

  it('excludes familiers and other non-CraftCheck equipment families', () => {
    expect(mapDofusDbCategories([
      { id: 18, categoryId: 0, name: { fr: 'Familier' }, superType: { id: 12, positions: [8], name: { fr: 'Familier' } } },
      { id: 1, categoryId: 0, name: { fr: 'Amulette' }, superType: { id: 1, positions: [0], name: { fr: 'Amulette' } } },
    ])).toEqual([
      expect.objectContaining({ id: 'equipment-type-1', label: 'Amulette' }),
    ]);
  });

  it('excludes unrelated DofusDB entity types', () => {
    expect(getDofusDbItemKind({
      id: 30820,
      name: { fr: '(MJ) timer' },
      type: { superType: { id: 26, positions: [], name: { fr: 'Certificat' } } },
    })).toBeUndefined();
    expect(mapDofusDbItem({
      id: 30820,
      name: { fr: '(MJ) timer' },
      type: { superType: { id: 26, name: { fr: 'Certificat' } } },
    })).toBeUndefined();
  });
});

describe('DofusDB server classification', () => {
  it('sorts permanent servers into mono-account and multi-account, straight from the API flag', () => {
    const servers = mapDofusDbServers([
      { id: 351, gameTypeId: 0, monoAccount: false, name: { fr: 'Brial' } },
      { id: 354, gameTypeId: 0, monoAccount: true, name: { fr: 'Mikhal' } },
      { id: 291, gameTypeId: 0, monoAccount: false, name: { fr: 'Imagiro' } },
      { id: 295, gameTypeId: 0, monoAccount: true, name: { fr: 'Draconiros' } },
    ]);

    expect(servers).toEqual([
      { id: 'brial', name: 'Brial', type: 'multi' },
      { id: 'draconiros', name: 'Draconiros', type: 'mono' },
      { id: 'imagiro', name: 'Imagiro', type: 'multi' },
      { id: 'mikhal', name: 'Mikhal', type: 'mono' },
    ]);
  });

  it('excludes event, Retro and flagged-inactive servers', () => {
    const servers = mapDofusDbServers([
      { id: 354, gameTypeId: 0, monoAccount: true, name: { fr: 'Mikhal' } },
      { id: 909, gameTypeId: 3, monoAccount: false, name: { fr: 'Speed Rush 1' } },
      { id: 501, gameTypeId: 2, monoAccount: false, name: { fr: 'Kidibom' } },
      { id: 800, gameTypeId: 0, monoAccount: false, name: { fr: 'Shukrute', en: '[!] Shukrute' } },
    ]);

    expect(servers.map((server) => server.name)).toEqual(['Mikhal']);
  });
});
