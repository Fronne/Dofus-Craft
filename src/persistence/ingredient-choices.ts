import type { IngredientChoice } from '../domain/types';

// specs/015 US3 (research.md §8): the player's forced "buy" / "craft" per resource, used instead of
// the cheaper of the two. Personal to the device, applies wherever the resource shows up, never
// shared. No entry means automatic (cheaper of the two).
const STORAGE_KEY = 'craftcheck-ingredient-choices';

export function getIngredientChoices(): Record<string, IngredientChoice> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, IngredientChoice] =>
      entry[1] === 'buy' || entry[1] === 'craft'));
  } catch {
    return {};
  }
}

export function setIngredientChoice(resourceId: string, choice: IngredientChoice | undefined): void {
  const next = getIngredientChoices();
  if (choice) next[resourceId] = choice;
  else delete next[resourceId];
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable — the choice just won't survive a reload.
  }
}
