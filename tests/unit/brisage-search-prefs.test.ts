import { beforeEach, describe, expect, it } from 'vitest';
import { defaultSearchPrefs, getSearchPrefs, mergeSearchPrefs, setSearchPrefs } from '../../src/persistence/brisage-search-prefs';

// specs/064-recherche-objets-par-stats: the remembered choices of the "Par stats" search.
describe('brisage search preferences', () => {
  beforeEach(() => window.localStorage.clear());

  it('starts from the defaults', () => {
    expect(getSearchPrefs()).toEqual(defaultSearchPrefs());
    expect(defaultSearchPrefs().sort).toBe('runes');
  });

  it('gives back what was saved', () => {
    setSearchPrefs({ effectIds: [176, 125], sort: 'kamas', minLevel: 100, maxLevel: 200 });
    expect(getSearchPrefs()).toEqual({ effectIds: [176, 125], sort: 'kamas', minLevel: 100, maxLevel: 200 });
  });

  it('falls back to the defaults on invalid JSON', () => {
    window.localStorage.setItem('craftcheck-brisage-search', '{pas du json');
    expect(getSearchPrefs()).toEqual(defaultSearchPrefs());
  });

  it('keeps only valid values field by field', () => {
    expect(mergeSearchPrefs({ effectIds: [176, 'x', 696969, 176, 1.5], sort: 'inconnu', minLevel: 0, maxLevel: '200' }))
      .toEqual({ effectIds: [176], sort: 'runes', minLevel: undefined, maxLevel: undefined });
    expect(mergeSearchPrefs(null)).toEqual(defaultSearchPrefs());
    expect(mergeSearchPrefs({ effectIds: 'non' }).effectIds).toEqual([]);
  });
});
