import itemTypes from './item-types.json';

// specs/071-sniffer-tous-hdv: the nature of a price sent by the friends' tool, from the DofusDB item type
// the HDV gives with it (`category`). item-types.json is built by scripts/build-item-types.mjs; a type
// left out of it (quest items, mutations…) has no nature and its prices are refused.
export type ItemType = 'equipment' | 'resource' | 'rune' | 'consumable';

const NATURES = itemTypes.natures as Record<string, ItemType>;

export function itemTypeOf(category: number): ItemType | undefined {
  return Object.prototype.hasOwnProperty.call(NATURES, String(category)) ? NATURES[String(category)] : undefined;
}
