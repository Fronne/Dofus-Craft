import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DOFUS_STORAGE_KEY, dofusThemes, readStoredDofus } from '../../src/domain/dofus-themes';

const storageWith = (value: string | null) => ({ getItem: (key: string) => (key === DOFUS_STORAGE_KEY ? value : null) });

describe('dofusThemes', () => {
  it('lists the six primordial Dofus in order', () => {
    expect(dofusThemes.map((dofus) => dofus.id)).toEqual(['emeraude', 'pourpre', 'turquoise', 'ocre', 'ebene', 'ivoire']);
    expect(new Set(dofusThemes.map((dofus) => dofus.image)).size).toBe(6);
  });

  it('has a picture in public/ for each Dofus', () => {
    for (const dofus of dofusThemes) expect(() => readFileSync(`public${dofus.image}`)).not.toThrow();
  });
});

describe('readStoredDofus', () => {
  it.each(dofusThemes.map((dofus) => dofus.id))('returns the stored %s', (id) => {
    expect(readStoredDofus(storageWith(id))).toBe(id);
  });

  it('falls back to the emerald when nothing or something unknown is stored', () => {
    expect(readStoredDofus(storageWith(null))).toBe('emeraude');
    expect(readStoredDofus(storageWith('dofus-vulbis'))).toBe('emeraude');
  });

  it('falls back to the emerald when the storage throws', () => {
    expect(readStoredDofus({ getItem: () => { throw new Error('blocked'); } })).toBe('emeraude');
  });
});

describe('index.html early script', () => {
  const html = readFileSync('index.html', 'utf8');

  it('knows every Dofus other than the emerald, with its icon and color', () => {
    for (const dofus of dofusThemes.filter((entry) => entry.id !== 'emeraude')) {
      expect(html).toContain(`${dofus.id}:`);
      expect(html).toContain(dofus.image);
      expect(html).toContain(dofus.themeColor);
    }
    expect(html).toContain(DOFUS_STORAGE_KEY);
  });
});
