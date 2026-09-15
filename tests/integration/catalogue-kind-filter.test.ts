import { beforeEach, expect, it, vi } from 'vitest';
import { getCategories, searchItems } from '../../src/data/catalogue-repository';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((input: string) => {
    const isTypesRequest = input.includes('/item-types?');
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
        total: 3,
        limit: 24,
        skip: 0,
        data: [
          { id: 2425, name: { fr: 'Amulette du Bouftou' }, hasRecipe: true, type: { id: 1, superType: { id: 1, name: { fr: 'Amulette' } } } },
          { id: 384, name: { fr: 'Laine de Bouftou' }, type: { id: 15, superType: { id: 9, name: { fr: 'Ressource' } } } },
          { id: 30820, name: { fr: '(MJ) timer' }, type: { id: 203, superType: { id: 26, name: { fr: 'Certificat' } } } },
        ],
      };
    return Promise.resolve(new Response(JSON.stringify(payload), { status: 200 }));
  }));
});

it('keeps equipment and resources strictly separated in the repository', async () => {
  expect(await getCategories()).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: 'equipment-type-1', kind: 'Equipment' }),
  ]));
  const equipment = await searchItems('', '');

  expect(equipment.data.map((item) => item.id)).toEqual(['2425']);
  expect(equipment.data.every((item) => item.kind === 'Equipment')).toBe(true);
  expect(await getCategories()).not.toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: 'Resource' }),
  ]));
});
