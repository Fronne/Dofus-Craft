import { useState } from 'react';
import type { IngredientChoice } from '../../domain/types';
import { getIngredientChoices, setIngredientChoice } from '../../persistence/ingredient-choices';

// specs/015 US3: forced buy/craft choices, read once and written through on every change.
export function useIngredientChoices() {
  const [choices, setChoices] = useState<Record<string, IngredientChoice>>(() => getIngredientChoices());
  const setChoice = (resourceId: string, choice: IngredientChoice | undefined) => {
    setIngredientChoice(resourceId, choice);
    // Updated locally too, so the choice applies for this visit even if storage is unavailable.
    setChoices((current) => {
      const next = { ...current };
      if (choice) next[resourceId] = choice;
      else delete next[resourceId];
      return next;
    });
  };
  return { choices, setChoice };
}
