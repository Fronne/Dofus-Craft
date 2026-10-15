import priceableItems from './fm/priceable-items.json';
import pricedExtras from './priced-extras.json';

// The resources whose price the site shows: the runes and every resource of src/data/hdv-items.json
// (recipe ingredients and pet foods, through fm/priceable-items.json), plus priced-extras.json. Never an
// equipment (equipment-items.json). Read by Huzounet's sync (specs/045) and, specs/056, the only ids the
// friends' price tool may send.
export const RESOURCE_IDS: string[] = [...new Set([
  ...Object.values(priceableItems.items as Record<string, string | null>).filter((id): id is string => id !== null),
  ...pricedExtras.ids,
])];

const KNOWN_RESOURCES = new Set(RESOURCE_IDS);

export function isKnownResource(id: string): boolean {
  return KNOWN_RESOURCES.has(id);
}
