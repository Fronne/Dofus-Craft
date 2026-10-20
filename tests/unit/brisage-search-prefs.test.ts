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
    setSearchPrefs({ effectIds: [176, 125], sort: 'kamas', minLevel: 100, maxLevel: 200, panelOpen: false });
    expect(getSearchPrefs()).toEqual({ effectIds: [176, 125], sort: 'kamas', minLevel: 100, maxLevel: 200, categoryId: undefined, panelOpen: false });
  });

  // specs/065-refonte-page-brisage: the category and the open / closed filter panel are remembered too.
  it('starts with every category and the panel closed', () => {
    expect(defaultSearchPrefs().categoryId).toBeUndefined();
    expect(defaultSearchPrefs().panelOpen).toBe(false);
  });

  it('gives back the category and the panel state', () => {
    setSearchPrefs({ effectIds: [125], sort: 'runes', categoryId: 'equipment-type-10', panelOpen: true });
    expect(getSearchPrefs()).toMatchObject({ effectIds: [125], categoryId: 'equipment-type-10', panelOpen: true });
  });

  it('falls back to the defaults for a missing or wrong-typed value, and reads an old save', () => {
    expect(mergeSearchPrefs({ effectIds: [176], sort: 'kamas' })).toMatchObject({ categoryId: undefined, panelOpen: false });
    expect(mergeSearchPrefs({ categoryId: 5, panelOpen: 'oui' })).toMatchObject({ categoryId: undefined, panelOpen: false });
    expect(mergeSearchPrefs({ categoryId: '' }).categoryId).toBeUndefined();
  });

  it('falls back to the defaults on invalid JSON', () => {
    window.localStorage.setItem('craftcheck-brisage-search', '{pas du json');
    expect(getSearchPrefs()).toEqual(defaultSearchPrefs());
  });

  it('keeps only valid values field by field', () => {
    expect(mergeSearchPrefs({ effectIds: [176, 'x', 696969, 176, 1.5], sort: 'inconnu', minLevel: 0, maxLevel: '200' }))
      .toEqual({ effectIds: [176], sort: 'runes', minLevel: undefined, maxLevel: undefined, categoryId: undefined, panelOpen: false });
    expect(mergeSearchPrefs(null)).toEqual(defaultSearchPrefs());
    expect(mergeSearchPrefs({ effectIds: 'non' }).effectIds).toEqual([]);
  });
});
