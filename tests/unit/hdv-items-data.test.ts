import { describe, expect, it } from 'vitest';
import hdvItems from '../../src/data/hdv-items.json';
import hdvTypeMap from '../../scripts/data/hdv-type-map.json';
import type { HdvItemsData } from '../../src/domain/hdv';

// specs/023-hdv-price-entry (contracts/hdv-items-data.md): the generated list stays consistent with
// the type map checked in game.
const data = hdvItems as HdvItemsData;
const typeMap = hdvTypeMap as { types: Record<string, string | null> };

describe('src/data/hdv-items.json', () => {
  it('lists each item once', () => {
    const ids = data.items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('puts each item in the HDV its type is mapped to, with a known type name', () => {
    for (const item of data.items) {
      expect(typeMap.types[String(item.typeId)]).toBe(item.hdv);
      expect(data.types[String(item.typeId)]).toBeTruthy();
    }
  });

  it('never lists Dragodinde certificates, pets, soul stones or runes', () => {
    const forbidden = new Set([97, 18, 309, 78, 211, 233]);
    expect(data.items.filter((item) => forbidden.has(item.typeId))).toEqual([]);
  });

  it('lists the exchangeable pet foods in the Créatures tab, including Croquette enrichie', () => {
    const animals = data.items.filter((item) => item.hdv === 'animals');
    expect(animals.filter((item) => item.typeId === 209).length).toBeGreaterThanOrEqual(30);
    expect(animals.some((item) => item.id === '20125' && item.name === 'Croquette enrichie')).toBe(true);
  });
});
