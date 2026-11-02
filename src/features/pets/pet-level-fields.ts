import {
  PET_MAX_LEVEL,
  PET_MIN_LEVEL,
  PET_XP_CURVE,
  levelForTotalXp,
  maxTotalXp,
  type PetLevelsInput,
} from '../../domain/pet-xp';

export type Field = 'currentLevel' | keyof PetLevelsInput;
// FR-002 (revised 2026-09-28): the current level and the pet's total XP are linked — typing a level
// fills the total XP with that level's cumulative XP, typing a total XP updates the level. The
// calculation always starts from the total XP, shown below the levels and more discreetly.
export const FIELDS: Record<Field, { key: Field; label: string; min: number; max: number; secondary?: boolean }> = {
  currentLevel: { key: 'currentLevel', label: 'Niveau actuel', min: PET_MIN_LEVEL, max: PET_MAX_LEVEL },
  targetLevel: { key: 'targetLevel', label: 'Niveau visé', min: PET_MIN_LEVEL + 1, max: PET_MAX_LEVEL },
  totalXp: { key: 'totalXp', label: 'XP totale du familier', min: 0, max: maxTotalXp(), secondary: true },
};

export const toText = (levels: PetLevelsInput): Record<Field, string> => ({
  currentLevel: String(levelForTotalXp(levels.totalXp).level),
  totalXp: String(levels.totalXp),
  targetLevel: String(levels.targetLevel),
});

export const isIntegerIn = (value: number, min: number, max: number) => Number.isInteger(value) && value >= min && value <= max;

// An emptied « Niveau actuel » counts as level 0 (FR-002, 2026-09-29): no error, the total XP back to 0,
// and the field shows « 0 » as its placeholder.
export const parseCurrentLevel = (text: string) => (text.trim() === '' ? PET_MIN_LEVEL : parse(text));

/** The fields after `key` was typed, with the linked field (level ↔ total XP) kept in step. */
export function withField(text: Record<Field, string>, key: Field, raw: string): Record<Field, string> {
  const value = clampToMax(raw, FIELDS[key].max);
  const next = { ...text, [key]: value };
  const number = key === 'currentLevel' ? parseCurrentLevel(value) : parse(value);
  if (key === 'currentLevel' && isIntegerIn(number, PET_MIN_LEVEL, PET_MAX_LEVEL)) {
    next.totalXp = String(PET_XP_CURVE[number]);
  } else if (key === 'totalXp' && isIntegerIn(number, 0, maxTotalXp())) {
    next.currentLevel = String(levelForTotalXp(number).level);
  }
  return next;
}

// A level typed above its maximum (e.g. 150) is brought back to that maximum right away, rather than
// left in the field with an error.
const clampToMax = (value: string, max: number | undefined) =>
  max !== undefined && value.trim() !== '' && Number(value) > max ? String(max) : value;

export const parse = (text: string) => (text.trim() === '' ? Number.NaN : Number(text));
