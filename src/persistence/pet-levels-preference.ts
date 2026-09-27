import { validatePetLevels, type PetLevelsInput } from '../domain/pet-xp';

// specs/022-pet-xp-calculator (FR-011): the last levels entered on the Familier page, kept on the
// device so a returning player finds them again. Anything unreadable falls back to the defaults.
const STORAGE_KEY = 'craftcheck-pet-levels';
export const DEFAULT_PET_LEVELS: PetLevelsInput = { currentLevel: 0, xpInLevel: 0, targetLevel: 100 };

export function getPetLevels(): PetLevelsInput {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_PET_LEVELS;
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_PET_LEVELS;
    const { currentLevel, xpInLevel, targetLevel } = parsed as Record<string, unknown>;
    const levels = { currentLevel, xpInLevel, targetLevel } as PetLevelsInput;
    return Object.keys(validatePetLevels(levels)).length === 0 ? levels : DEFAULT_PET_LEVELS;
  } catch {
    return DEFAULT_PET_LEVELS;
  }
}

export function setPetLevels(levels: PetLevelsInput): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(levels));
  } catch {
    // Private browsing or blocked storage: the levels just aren't remembered.
  }
}
