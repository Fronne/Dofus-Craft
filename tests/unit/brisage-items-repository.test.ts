import { describe, expect, it } from 'vitest';
import { loadBrisageItemsIndex, parseBrisageItemsIndex } from '../../src/data/brisage-items-repository';

// specs/064-recherche-objets-par-stats: the index of items is read defensively.
const valid = {
  source: 'DofusDB',
  sourceUrl: 'https://api.dofusdb.fr',
  retrievedAt: '2026-10-20',
  items: [{ id: '70', name: 'Amulette du Hibou', level: 8, imageUrl: 'https://x/1.png', effects: [{ effectId: 126, from: 13, to: 10 }] }],
};

describe('parseBrisageItemsIndex', () => {
  it('reads a valid index and orders each range', () => {
    const index = parseBrisageItemsIndex(valid);
    expect(index.retrievedAt).toBe('2026-10-20');
    expect(index.items[0].effects).toEqual([{ effectId: 126, from: 10, to: 13 }]);
  });

  it('drops an item of the wrong shape and a line without a positive roll', () => {
    const index = parseBrisageItemsIndex({
      ...valid,
      items: [
        ...valid.items,
        { id: 3, name: 'Id numérique', level: 1, effects: [{ effectId: 1, from: 1, to: 2 }] },
        { id: '4', name: 'Sans effet utile', level: 1, effects: [{ effectId: 1, from: 0, to: 0 }, { effectId: 'x' }] },
        null,
      ],
    });
    expect(index.items.map((item) => item.id)).toEqual(['70']);
  });

  it.each([null, 'texte', {}, { items: [] }, { items: 'non', retrievedAt: '2026-10-20' }])('refuses %j', (value) => {
    expect(() => parseBrisageItemsIndex(value)).toThrow();
  });
});

describe('loadBrisageItemsIndex', () => {
  it('loads the shipped index', async () => {
    const index = await loadBrisageItemsIndex();
    expect(index.items.length).toBeGreaterThan(100);
    expect(index.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // specs/065-refonte-page-brisage: each item carries its Recherche category.
  it('gives a category to every item of the shipped index', async () => {
    const index = await loadBrisageItemsIndex();
    for (const item of index.items) expect(item.categoryId).toMatch(/^equipment-type-\d+$/);
  });
});

describe('item categories', () => {
  it('reads the category of an item and keeps an item without a valid one', () => {
    const index = parseBrisageItemsIndex({
      ...valid,
      items: [
        { ...valid.items[0], categoryId: 'equipment-type-1' },
        { ...valid.items[0], id: '71', categoryId: 5 },
        { ...valid.items[0], id: '72' },
      ],
    });
    expect(index.items.map((item) => item.categoryId)).toEqual(['equipment-type-1', undefined, undefined]);
  });
});
