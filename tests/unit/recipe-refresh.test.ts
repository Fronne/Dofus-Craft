import { describe, expect, it } from 'vitest';
import { RECIPE_REFRESH_MAX_IDS, recipeRefreshIds, recipeRefreshMessage } from '../../src/domain/recipe-refresh';

const resources = (count: number) => Array.from({ length: count }, (_, index) => String(1000 + index));

describe('recipeRefreshIds (specs/047)', () => {
  it('asks for the item alone when its recipe has no resource', () => {
    expect(recipeRefreshIds('14076', [])).toEqual(['14076']);
  });

  it('puts the item first, then the resources of the chain', () => {
    expect(recipeRefreshIds('14076', ['303', '16489'])).toEqual(['14076', '303', '16489']);
  });

  it.each([[89, 90], [90, 90], [91, 90]])('keeps at most 90 ids for %i resources (%i asked for)', (count, expected) => {
    const ids = recipeRefreshIds('14076', resources(count));
    expect(ids).toHaveLength(expected);
    expect(ids.length).toBeLessThanOrEqual(RECIPE_REFRESH_MAX_IDS);
    expect(ids[0]).toBe('14076');
  });

  it('leaves out the last resources, never the item, beyond the limit', () => {
    const all = resources(91);
    expect(recipeRefreshIds('14076', all)).toEqual(['14076', ...all.slice(0, 89)]);
  });

  it('asks for each id once, the item included', () => {
    expect(recipeRefreshIds('14076', ['303', '303', '14076', '16489'])).toEqual(['14076', '303', '16489']);
  });

  it('leaves out ids the API would refuse', () => {
    expect(recipeRefreshIds('item-1', ['303', 'resource-1', '', '12a', '16489'])).toEqual(['303', '16489']);
  });
});

describe('recipeRefreshMessage (specs/047)', () => {
  it('tells what happened, with the words of the live site', () => {
    expect(recipeRefreshMessage({ status: 'ok', refreshed: 3 })).toBe('Prix actualisés.');
    expect(recipeRefreshMessage({ status: 'ok', refreshed: 0 })).toBe('Les prix sont déjà à jour.');
    expect(recipeRefreshMessage({ status: 'too-soon' })).toBe('Réessaie dans quelques secondes.');
    expect(recipeRefreshMessage({ status: 'not-read' })).toBe('Les prix de ce serveur ne sont pas relus.');
    expect(recipeRefreshMessage({ status: 'unavailable' })).toBe('Actualisation impossible pour le moment.');
  });
});
