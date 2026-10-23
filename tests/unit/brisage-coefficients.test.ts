import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getStoredCoefficient, hasImportedCoefficients, latestCoefficient, listImportableCoefficients, listStoredCoefficients, markCoefficientsImported, saveCoefficient } from '../../src/persistence/brisage-coefficients';

// specs/061-simplification-page-brisage (FR-004): the last coefficient of an item, kept on the device.
const KEY = 'craftcheck-brisage-coefficients';

describe('brisage-coefficients', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('has nothing for an item never broken', () => {
    expect(getStoredCoefficient('mikhal', '777')).toBeUndefined();
  });

  it('round-trips a coefficient with its date, per server and item', () => {
    const saved = saveCoefficient('mikhal', '777', 38);
    expect(saved?.coefficient).toBe(38);
    expect(getStoredCoefficient('mikhal', '777')).toEqual(saved);
    expect(Date.parse(saved!.savedAt)).not.toBeNaN();
    expect(getStoredCoefficient('other', '777')).toBeUndefined();
    expect(getStoredCoefficient('mikhal', '888')).toBeUndefined();
  });

  it('replaces the coefficient and keeps the other items', () => {
    saveCoefficient('mikhal', '777', 50);
    saveCoefficient('mikhal', '888', 20);
    saveCoefficient('mikhal', '777', 44);
    expect(getStoredCoefficient('mikhal', '777')?.coefficient).toBe(44);
    expect(getStoredCoefficient('mikhal', '888')?.coefficient).toBe(20);
  });

  it('refuses a coefficient out of bounds', () => {
    expect(saveCoefficient('mikhal', '777', 0)).toBeUndefined();
    expect(saveCoefficient('mikhal', '777', 4001)).toBeUndefined();
    expect(getStoredCoefficient('mikhal', '777')).toBeUndefined();
  });

  it('ignores corrupted storage and invalid entries', () => {
    window.localStorage.setItem(KEY, '{not json');
    expect(getStoredCoefficient('mikhal', '777')).toBeUndefined();
    window.localStorage.setItem(KEY, JSON.stringify({ 'mikhal:777': { coefficient: 500, savedAt: 'x' } }));
    expect(getStoredCoefficient('mikhal', '777')).toBeUndefined();
    window.localStorage.setItem(KEY, '[1]');
    expect(getStoredCoefficient('mikhal', '777')).toBeUndefined();
  });

  it('survives a storage that throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(getStoredCoefficient('mikhal', '777')).toBeUndefined();
    expect(saveCoefficient('mikhal', '777', 40)?.coefficient).toBe(40);
  });
});

describe('shared coefficients (specs/069)', () => {
  beforeEach(() => window.localStorage.clear());

  it('latestCoefficient keeps the more recent one, and the one that exists', () => {
    const old = { coefficient: 30, savedAt: '2026-10-22T10:00:00.000Z' };
    const recent = { coefficient: 40, savedAt: '2026-10-23T10:00:00.000Z' };
    expect(latestCoefficient(old, recent)).toBe(recent);
    expect(latestCoefficient(recent, old)).toBe(recent);
    expect(latestCoefficient(old, undefined)).toBe(old);
    expect(latestCoefficient(undefined, recent)).toBe(recent);
    expect(latestCoefficient(undefined, undefined)).toBeUndefined();
  });

  it('lists the notes to import with their original date, and drops those before 21/10/2026 17:30 Paris', () => {
    window.localStorage.setItem(KEY, JSON.stringify({
      'mikhal:777': { coefficient: 44, savedAt: '2026-10-21T15:30:00.000Z' },
      'mikhal:888': { coefficient: 20, savedAt: '2026-10-21T15:29:59.999Z' },
      'dakal:999': { coefficient: 12.5, savedAt: '2026-10-22T08:00:00.000Z' },
      'mikhal:bad': { coefficient: 0, savedAt: '2026-10-22T08:00:00.000Z' },
      nocolon: { coefficient: 5, savedAt: '2026-10-22T08:00:00.000Z' },
    }));
    expect(listImportableCoefficients(new Date('2026-10-23T00:00:00.000Z'))).toEqual([
      { serverId: 'mikhal', itemId: '777', coefficient: 44, savedAt: '2026-10-21T15:30:00.000Z' },
      { serverId: 'dakal', itemId: '999', coefficient: 12.5, savedAt: '2026-10-22T08:00:00.000Z' },
    ]);
  });

  it('leaves out notes the server would refuse: older than 90 days or dated in the future', () => {
    window.localStorage.setItem(KEY, JSON.stringify({
      'mikhal:1': { coefficient: 44, savedAt: '2026-11-01T10:00:00.000Z' },
      'mikhal:2': { coefficient: 44, savedAt: '2026-10-22T10:00:00.000Z' },
      'mikhal:3': { coefficient: 44, savedAt: '2027-03-01T10:00:00.000Z' },
    }));
    expect(listImportableCoefficients(new Date('2027-01-25T00:00:00.000Z')).map((note) => note.itemId)).toEqual(['1']);
    expect(listImportableCoefficients(new Date('2026-11-05T00:00:00.000Z')).map((note) => note.itemId)).toEqual(['1', '2']);
  });

  it('remembers that the import is done', () => {
    expect(hasImportedCoefficients()).toBe(false);
    markCoefficientsImported();
    expect(hasImportedCoefficients()).toBe(true);
  });
});

// specs/072-classement-brisage (T002): the coefficients kept on the device, listed for one server.
describe('listStoredCoefficients (specs/072)', () => {
  beforeEach(() => window.localStorage.clear());

  it('lists the coefficients of the server by item id', () => {
    saveCoefficient('mikhal', '777', 38);
    saveCoefficient('mikhal', '888', 50);
    const list = listStoredCoefficients('mikhal');
    expect([...list.keys()].sort()).toEqual(['777', '888']);
    expect(list.get('777')?.coefficient).toBe(38);
  });

  it('ignores the coefficients of another server', () => {
    saveCoefficient('mikhal', '777', 38);
    saveCoefficient('kourial', '777', 90);
    expect(listStoredCoefficients('mikhal').get('777')?.coefficient).toBe(38);
    expect(listStoredCoefficients('kourial').get('777')?.coefficient).toBe(90);
  });

  it('ignores an invalid entry and unreadable storage', () => {
    window.localStorage.setItem(KEY, JSON.stringify({
      'mikhal:1': { coefficient: -3, savedAt: '2026-10-20T10:00:00.000Z' },
      'mikhal:2': { coefficient: 40, savedAt: 'not a date' },
      'mikhal:3': { coefficient: 41, savedAt: '2026-10-20T10:00:00.000Z' },
    }));
    expect([...listStoredCoefficients('mikhal').keys()]).toEqual(['3']);
    window.localStorage.setItem(KEY, '{not json');
    expect(listStoredCoefficients('mikhal').size).toBe(0);
  });
});
