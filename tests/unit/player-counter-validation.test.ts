import { describe, expect, it } from 'vitest';
import {
  counterLabel,
  formatCount,
  isPlayerCounter,
  unitFor,
  validateCounterInput,
  type PlayerCounterInput,
} from '../../src/domain/player-counter';

const valid: PlayerCounterInput = {
  player: 'Nicomoux',
  breedId: 12,
  sex: 'm',
  count: 157,
  atLeast: false,
  unitOne: 'tentative de FM',
  unitMany: 'tentatives de FM',
  target: { itemId: 14094, name: 'Amulette du Strigide', icon: 'https://api.dofusdb.fr/img/items/1235.png' },
};

function refusedField(input: unknown, mode: 'create' | 'update' = 'create') {
  const result = validateCounterInput(input, mode);
  return result.ok ? undefined : result.field;
}

describe('player counter validation (specs/014-admin-counters, FR-012)', () => {
  it('accepts a complete counter', () => {
    expect(validateCounterInput(valid, 'create')).toEqual({ ok: true, value: valid });
  });

  it('trims texts', () => {
    const result = validateCounterInput({ ...valid, player: '  Nicomoux  ' }, 'create');
    expect(result.ok && result.value.player).toBe('Nicomoux');
  });

  it.each([
    ['player', { player: '' }],
    ['player', { player: 'x'.repeat(41) }],
    ['breedId', { breedId: 19 }],
    ['breedId', { breedId: '12' }],
    ['sex', { sex: 'x' }],
    ['count', { count: -1 }],
    ['count', { count: 1.5 }],
    ['count', { count: '157' }],
    ['atLeast', { atLeast: 'yes' }],
    ['unitOne', { unitOne: ' ' }],
    ['unitMany', { unitMany: 'y'.repeat(41) }],
    ['target', { target: undefined }],
    ['target', { target: { ...valid.target, itemId: 0 } }],
    ['target', { target: { ...valid.target, name: '' } }],
    ['target', { target: { ...valid.target, icon: 'https://evil.example/x.png' } }],
  ])('refuses an invalid %s', (field, patch) => {
    expect(refusedField({ ...valid, ...patch })).toBe(field);
  });

  it('refuses something that is not an object', () => {
    expect(refusedField(null)).toBe('body');
  });

  it('validates only the fields sent in an update', () => {
    expect(validateCounterInput({ count: 162, atLeast: false }, 'update')).toEqual({ ok: true, value: { count: 162, atLeast: false } });
    expect(refusedField({ count: -3 }, 'update')).toBe('count');
    expect(refusedField({}, 'update')).toBe('body');
  });

  it('never lets an update smuggle unknown fields through', () => {
    const result = validateCounterInput({ count: 3, id: 'other' }, 'update');
    expect(result).toEqual({ ok: true, value: { count: 3 } });
  });
});

describe('player counter display', () => {
  const counter = { ...valid, id: 'a', createdAt: '', updatedAt: '' };

  it('shows "at least" counts with a +', () => {
    expect(formatCount({ count: 150, atLeast: true })).toBe('150+');
    expect(formatCount({ count: 157, atLeast: false })).toBe('157');
  });

  it('uses the singular for 0 or 1', () => {
    expect(unitFor({ ...counter, count: 1 })).toBe('tentative de FM');
    expect(unitFor(counter)).toBe('tentatives de FM');
  });

  it('builds the accessible label', () => {
    expect(counterLabel(counter)).toBe('Compteur de tentatives de FM de Nicomoux');
  });

  it('recognizes a counter received from the API', () => {
    expect(isPlayerCounter(counter)).toBe(true);
    expect(isPlayerCounter({ ...counter, id: 3 })).toBe(false);
    expect(isPlayerCounter({ ...counter, count: -1 })).toBe(false);
  });
});
