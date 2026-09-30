import { describe, expect, it } from 'vitest';
import runeItems from '../../src/data/rune-items.json';
import priceableItems from '../../worker/src/fm/priceable-items.json';
import { normalizeItemName, type RuneItemsData } from '../../src/domain/forgemagie';

// specs/025-rune-purchase-import (contracts/rune-items-data.md): the generated rune list and the name
// index the Worker recognizes purchase lines with.
const data = runeItems as RuneItemsData;
const index = (priceableItems as { items: Record<string, string | null> }).items;

describe('src/data/rune-items.json', () => {
  it('lists every rune once, with an icon and a stat', () => {
    expect(data.runes.length).toBeGreaterThanOrEqual(100);
    expect(new Set(data.runes.map((rune) => rune.id)).size).toBe(data.runes.length);
    for (const rune of data.runes) {
      expect(rune.imageUrl).toMatch(/^https:\/\//);
      expect(rune.statLabel).not.toBe('');
    }
  });

  it('tells damage runes from resistance runes of the same element', () => {
    const labelOf = (name: string) => data.runes.find((rune) => rune.name === name)?.statLabel;
    expect(labelOf('Rune Fo')).toBe('Force');
    expect(data.runes.find((rune) => rune.name === 'Rune Fo')?.characteristicId).toBe(10);
    expect(labelOf('Rune Do Air')).toBe('Dommages Air');
    expect(labelOf('Rune Ré Air')).toBe('Résistances Air');
    expect(labelOf('Rune Ré Per Air')).toBe('Résistance Air (%)');
  });
});

describe('worker/src/fm/priceable-items.json', () => {
  it('recognizes every rune by its normalized name', () => {
    for (const rune of data.runes) expect(index[normalizeItemName(rune.name)]).toBe(rune.id);
  });

  it('only uses normalized names as keys', () => {
    for (const key of Object.keys(index)) expect(key).toBe(normalizeItemName(key));
  });
});
