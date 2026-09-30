import { describe, expect, it } from 'vitest';
import { countPriced, filterByPrice, filterHdvItems, HDV_TABS, isHdvId, itemsForHdv, typesInTab, type HdvItem, type HdvItemsData } from '../../src/domain/hdv';
import { PRICE_AGE_EXPIRED_DAYS, PRICE_AGE_STALE_DAYS } from '../../src/domain/price-age';
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
const price = (resourceId: string, updatedAt: string): ResourcePrice => ({ resourceId, unitPriceKamas: 100, updatedAt });

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

  it('counts and filters any list of priced entries, runes included (specs/026)', () => {
    const runes = [{ id: 'r1', name: 'Rune Fo' }, { id: 'r2', name: 'Rune Sa' }];
    const prices = { r1: price('r1', daysAgo(1)) };
    expect(countPriced(runes, prices)).toEqual({ priced: 1, total: 2 });
    expect(filterByPrice(runes, prices, 'missing', NOW)).toEqual([runes[1]]);
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
    '2': price('2', daysAgo(PRICE_AGE_STALE_DAYS)),
  };

  it('counts the items with a carnet entry, out of the whole tab', () => {
    expect(countPriced(items, prices)).toEqual({ priced: 2, total: 3 });
  });

  it('keeps the items with no price for « Sans prix »', () => {
    expect(filterByPrice(items, prices, 'missing', NOW)).toEqual([beer]);
  });

  it('keeps the stale or expired prices for « Prix ancien », using the Recherche page rule', () => {
    const withLimits = {
      '1': price('1', daysAgo(PRICE_AGE_STALE_DAYS - 0.1)),
      '2': price('2', daysAgo(PRICE_AGE_STALE_DAYS)),
      '3': price('3', daysAgo(PRICE_AGE_EXPIRED_DAYS)),
    };
    expect(filterByPrice(items, withLimits, 'old', NOW)).toEqual([potionAccent, beer]);
  });

  it('never counts a price without date as old', () => {
    expect(filterByPrice([potion], { '1': { resourceId: '1', unitPriceKamas: 100, updatedAt: '' } }, 'old', NOW)).toEqual([]);
  });

  it('keeps everything for « Tous »', () => {
    expect(filterByPrice(items, prices, 'all', NOW)).toEqual(items);
  });
});
