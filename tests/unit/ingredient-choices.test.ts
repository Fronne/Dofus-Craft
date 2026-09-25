import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getIngredientChoices, setIngredientChoice } from '../../src/persistence/ingredient-choices';

describe('ingredient choices (specs/015 US3)', () => {
  beforeEach(() => window.localStorage.clear());

  it('has no forced choice by default (automatic everywhere)', () => {
    expect(getIngredientChoices()).toEqual({});
  });

  it('keeps a forced "buy" or "craft" per resource', () => {
    setIngredientChoice('16489', 'buy');
    setIngredientChoice('303', 'craft');
    expect(getIngredientChoices()).toEqual({ '16489': 'buy', '303': 'craft' });
  });

  it('goes back to automatic by removing the entry', () => {
    setIngredientChoice('16489', 'buy');
    setIngredientChoice('16489', undefined);
    expect(getIngredientChoices()).toEqual({});
  });

  it('ignores invalid stored data and unknown values', () => {
    window.localStorage.setItem('craftcheck-ingredient-choices', 'not json');
    expect(getIngredientChoices()).toEqual({});
    window.localStorage.setItem('craftcheck-ingredient-choices', JSON.stringify({ a: 'buy', b: 'steal', c: 3 }));
    expect(getIngredientChoices()).toEqual({ a: 'buy' });
  });

  it('works without localStorage, without throwing', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('disabled'); });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('disabled'); });
    expect(getIngredientChoices()).toEqual({});
    expect(() => setIngredientChoice('16489', 'buy')).not.toThrow();
    getItem.mockRestore();
    setItem.mockRestore();
  });
});
