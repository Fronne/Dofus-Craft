import { isKnownBreedId, type Sex } from './breeds';

// specs/014-admin-counters (data-model.md): a humorous per-player counter, shared by the public site
// (bubbles), the administration page and the administration Worker — one set of rules for all three.
export type CounterTarget = { itemId: number; name: string; icon: string };

export type PlayerCounterInput = {
  player: string;
  breedId: number;
  sex: Sex;
  count: number;
  atLeast: boolean;
  unitOne: string;
  unitMany: string;
  target: CounterTarget;
};

export type PlayerCounter = PlayerCounterInput & { id: string; createdAt: string; updatedAt: string };

export type CounterValidation<T> = { ok: true; value: T } | { ok: false; field: string; error: string };

const MAX_TEXT = 40;
const ICON_PREFIX = 'https://api.dofusdb.fr/img/items/';
const FIELDS = ['player', 'breedId', 'sex', 'count', 'atLeast', 'unitOne', 'unitMany', 'target'] as const;
type Field = (typeof FIELDS)[number];

type Check = { ok: true; value: unknown } | { ok: false; error: string };

function shortText(value: unknown, what: string): Check {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > MAX_TEXT) return { ok: false, error: `${what} est obligatoire (${MAX_TEXT} caractères au plus).` };
  return { ok: true, value: text };
}

function isTarget(value: unknown): value is CounterTarget {
  if (typeof value !== 'object' || value === null) return false;
  const target = value as Record<string, unknown>;
  return Number.isInteger(target.itemId) && (target.itemId as number) > 0 &&
    typeof target.name === 'string' && target.name.trim().length > 0 &&
    typeof target.icon === 'string' && target.icon.startsWith(ICON_PREFIX);
}

const CHECKS: Record<Field, (value: unknown) => Check> = {
  player: (value) => shortText(value, 'Le pseudo'),
  breedId: (value) => (isKnownBreedId(value) ? { ok: true, value } : { ok: false, error: 'Choisissez une classe.' }),
  sex: (value) => (value === 'm' || value === 'f' ? { ok: true, value } : { ok: false, error: 'Choisissez homme ou femme.' }),
  count: (value) => (Number.isInteger(value) && (value as number) >= 0
    ? { ok: true, value }
    : { ok: false, error: 'Le chiffre doit être un nombre entier positif ou nul.' }),
  atLeast: (value) => (typeof value === 'boolean' ? { ok: true, value } : { ok: false, error: '« Au moins » doit être coché ou non.' }),
  unitOne: (value) => shortText(value, 'Le libellé au singulier'),
  unitMany: (value) => shortText(value, 'Le libellé au pluriel'),
  target: (value) => (isTarget(value)
    ? { ok: true, value: { itemId: value.itemId, name: value.name.trim(), icon: value.icon } }
    : { ok: false, error: 'Choisissez l\'objet visé dans le catalogue.' }),
};

// FR-012: "create" needs every field; "update" validates only the fields sent (at least one), and
// drops anything that isn't a counter field so an update can never touch id or dates.
export function validateCounterInput(input: unknown, mode: 'create'): CounterValidation<PlayerCounterInput>;
export function validateCounterInput(input: unknown, mode: 'update'): CounterValidation<Partial<PlayerCounterInput>>;
export function validateCounterInput(
  input: unknown,
  mode: 'create' | 'update',
): CounterValidation<PlayerCounterInput | Partial<PlayerCounterInput>>;
export function validateCounterInput(
  input: unknown,
  mode: 'create' | 'update',
): CounterValidation<PlayerCounterInput | Partial<PlayerCounterInput>> {
  if (typeof input !== 'object' || input === null) return { ok: false, field: 'body', error: 'Données manquantes.' };
  const record = input as Record<string, unknown>;
  const fields = mode === 'create' ? FIELDS : FIELDS.filter((field) => field in record);
  if (fields.length === 0) return { ok: false, field: 'body', error: 'Rien à modifier.' };
  const value: Record<string, unknown> = {};
  for (const field of fields) {
    const check = CHECKS[field](record[field]);
    if (!check.ok) return { ok: false, field, error: check.error };
    value[field] = check.value;
  }
  return { ok: true, value: value as PlayerCounterInput };
}

export function isPlayerCounter(value: unknown): value is PlayerCounter {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === 'string' && typeof record.createdAt === 'string' &&
    typeof record.updatedAt === 'string' && validateCounterInput(record, 'create').ok;
}

// "150+" when the exact number isn't known.
export function formatCount(counter: { count: number; atLeast: boolean }): string {
  return counter.atLeast ? `${counter.count}+` : String(counter.count);
}

export function unitFor(counter: PlayerCounterInput): string {
  return counter.count > 1 ? counter.unitMany : counter.unitOne;
}

export function counterLabel(counter: PlayerCounterInput): string {
  return `Compteur de ${counter.unitMany} de ${counter.player}`;
}
