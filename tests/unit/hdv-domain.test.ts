import { describe, expect, it } from 'vitest';
import { countPriced, filterHdvItems, HDV_SORTS, HDV_TABS, isHdvId, isHdvSort, itemsForHdv, sortHdvLines, typesInTab, type HdvItem, type HdvItemsData } from '../../src/domain/hdv';
import type { ResourcePrice } from '../../src/domain/types';

// specs/023-hdv-price-entry: pure rules of the HDV price-entry page.
const item = (id: string, name: string, typeId: number, hdv: HdvItem['hdv'] = 'consumables'): HdvItem => ({ id, name, typeId, hdv });
const potion = item('1', 'Potion de Soin', 12);
const potionAccent = item('2', 'Pôtion Étrange', 12);
const beer = item('3', 'Bière', 37);
const items = [potion, potionAccent, beer];
const typeNames = { '12': 'Potion', '37': 'Bière', '15': 'Ressource diverse' };

const NOW = new Date('2026-09-28T12:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
const price = (resourceId: string, updatedAt: string, unitPriceKamas = 100): ResourcePrice => ({ resourceId, unitPriceKamas, updatedAt });

describe('HDV tabs', () => {
  it('keeps only the items of one HDV, sorted by name', () => {
    const data = { items: [beer, item('9', 'Ail', 15, 'resources'), potion] } as HdvItemsData;
    expect(itemsForHdv(data, 'consumables').map((entry) => entry.name)).toEqual(['Bière', 'Potion de Soin']);
  });

  it('recognises the three HDV ids and the Runes tab (specs/026)', () => {
    expect(isHdvId('animals')).toBe(true);
    expect(isHdvId('runes')).toBe(true);
    expect(isHdvId('equipment')).toBe(false);
    expect(isHdvId(null)).toBe(false);
  });

  it('ends with the Runes tab, whose items are not read from hdv-items.json (specs/026)', () => {
    expect(HDV_TABS.map((tab) => tab.label)).toEqual(['Ressources', 'Consommables', 'Créatures', 'Runes']);
    expect(itemsForHdv({ items: [beer, potion] } as HdvItemsData, 'runes')).toEqual([]);
  });

  it('counts and sorts any list of priced entries, runes included (specs/026, specs/048)', () => {
    const runes = [{ id: 'r1', name: 'Rune Fo' }, { id: 'r2', name: 'Rune Sa' }];
    const prices = { r1: price('r1', daysAgo(1)) };
    expect(countPriced(runes, prices)).toEqual({ priced: 1, total: 2 });
    expect(sortHdvLines([runes[1], runes[0]], prices, 'price-desc')).toEqual([runes[0], runes[1]]);
  });
});

describe('filterHdvItems (FR-008)', () => {
  it('matches the name whatever the accents or the case', () => {
    expect(filterHdvItems(items, { query: 'POT', typeId: '' })).toEqual([potion, potionAccent]);
    expect(filterHdvItems(items, { query: 'etrange', typeId: '' })).toEqual([potionAccent]);
  });

  it('keeps only the chosen type', () => {
    expect(filterHdvItems(items, { query: '', typeId: 37 })).toEqual([beer]);
  });

  it('offers only the types present in the tab, sorted by name', () => {
    expect(typesInTab(items, typeNames)).toEqual([{ id: 37, name: 'Bière' }, { id: 12, name: 'Potion' }]);
  });
});

describe('prices of a tab (FR-010)', () => {
  const prices = {
    '1': price('1', daysAgo(1)),
    '2': price('2', daysAgo(8)),
  };

  it('counts the items with a carnet entry, out of the whole tab', () => {
    expect(countPriced(items, prices)).toEqual({ priced: 2, total: 3 });
  });

});

describe('sortHdvLines (specs/048)', () => {
  const water = item('4', 'Eau', 12);
  const lines = [potion, potionAccent, beer, water];
  // potion: 300 kamas, 3 days ago; potionAccent: 50, yesterday; beer: no price; water: 900, 10 days ago.
  const prices = {
    '1': price('1', daysAgo(3), 300),
    '2': price('2', daysAgo(1), 50),
    '4': price('4', daysAgo(10), 900),
  };

  it('offers the four named sorts of the live site, in its order', () => {
    expect(HDV_SORTS.map((sort) => sort.label)).toEqual(['Prix le plus élevé', 'Prix le plus bas', 'Mis à jour récemment', 'Mis à jour il y a longtemps']);
  });

  it('leaves the list as it is for the tab\'s own order', () => {
    expect(sortHdvLines(lines, prices, 'default')).toBe(lines);
  });

  it('sorts by price, the lines without a price last', () => {
    expect(sortHdvLines(lines, prices, 'price-desc')).toEqual([water, potion, potionAccent, beer]);
    expect(sortHdvLines(lines, prices, 'price-asc')).toEqual([potionAccent, potion, water, beer]);
  });

  it('sorts by date of the price, the lines without a price last', () => {
    expect(sortHdvLines(lines, prices, 'recent')).toEqual([potionAccent, potion, water, beer]);
    expect(sortHdvLines(lines, prices, 'oldest')).toEqual([water, potion, potionAccent, beer]);
  });

  it('keeps the order of the tab between lines that tie, and between lines without a price', () => {
    const same = { '1': price('1', daysAgo(2), 100), '2': price('2', daysAgo(2), 100), '4': price('4', daysAgo(2), 100) };
    const tea = item('5', 'Thé', 12);
    for (const sort of ['price-desc', 'price-asc', 'recent', 'oldest'] as const) {
      expect(sortHdvLines([potion, beer, potionAccent, tea, water], same, sort)).toEqual([potion, potionAccent, water, beer, tea]);
    }
  });

  it('counts a price whose date cannot be read as the oldest', () => {
    const undated = { ...prices, '3': price('3', '', 10) };
    expect(sortHdvLines(lines, undated, 'oldest')[0]).toBe(beer);
    expect(sortHdvLines(lines, undated, 'recent')).toEqual([potionAccent, potion, water, beer]);
  });

  it('changes nothing in a tab without any price, nor in the list it is given', () => {
    const before = [...lines];
    expect(sortHdvLines(lines, {}, 'price-desc')).toEqual(lines);
    sortHdvLines(lines, prices, 'price-asc');
    expect(lines).toEqual(before);
  });

  it('knows its sorts, and nothing else', () => {
    expect(['default', 'price-desc', 'price-asc', 'recent', 'oldest'].every(isHdvSort)).toBe(true);
    expect(isHdvSort('missing')).toBe(false);
    expect(isHdvSort(null)).toBe(false);
  });
});
