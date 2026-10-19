import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getStoredCoefficient, saveCoefficient } from '../../src/persistence/brisage-coefficients';

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
