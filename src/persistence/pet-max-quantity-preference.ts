import { DEFAULT_PET_FOOD_MAX_QUANTITY } from '../domain/pet-xp';

// specs/022-pet-xp-calculator (FR-008b): the « Quantité max » of the XP Familier list, kept on the
// device. `null` is stored for an emptied field (no cap), so it isn't mistaken for "never set".
const STORAGE_KEY = 'craftcheck-pet-max-quantity';

export function getPetMaxQuantity(): number | undefined {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === null) return DEFAULT_PET_FOOD_MAX_QUANTITY;
    const parsed: unknown = JSON.parse(stored);
    if (parsed === null) return undefined;
    return typeof parsed === 'number' && Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_PET_FOOD_MAX_QUANTITY;
  } catch {
    return DEFAULT_PET_FOOD_MAX_QUANTITY;
  }
}

export function setPetMaxQuantity(maxQuantity: number | undefined): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(maxQuantity ?? null));
  } catch {
    // Private browsing or blocked storage: the cap just isn't remembered.
  }
}
