import { describe, expect, it } from 'vitest';
import { itemTypeOf } from '../../worker/src/item-types';
import itemTypes from '../../worker/src/item-types.json';

// specs/071-sniffer-tous-hdv (plan.md R1): the nature of a DofusDB item type.
describe('itemTypeOf (specs/071)', () => {
  it.each([
    [107, 'resource'], // Carapace Verte, checked in game by the tool
    [78, 'rune'],
    [9, 'equipment'], // ring (Palmano)
    [40, 'resource'], // alloy (Ébonite)
    [12, 'consumable'], // potion
    [28, 'consumable'], // boost food
    [83, 'consumable'], // soul stone
    [18, 'equipment'], // pet
    [23, 'equipment'], // Dofus
    [82, 'equipment'], // shield
  ])('type %i is %s', (category, nature) => {
    expect(itemTypeOf(category)).toBe(nature);
  });

  it.each([126, 24, 32, 0, 99_999])('type %i has no nature', (category) => {
    expect(itemTypeOf(category)).toBeUndefined();
  });

  it('is generated from DofusDB, with a single rune type', () => {
    expect(itemTypes.source).toBe('https://api.dofusdb.fr/item-types');
    expect(Object.values(itemTypes.natures).filter((nature) => nature === 'rune')).toHaveLength(1);
  });
});
