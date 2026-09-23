import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasSeenSearchTour, markSearchTourSeen } from '../../src/persistence/search-tour-preference';

describe('search tour preference', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('is not seen when the key is absent', () => {
    expect(hasSeenSearchTour()).toBe(false);
  });

  it('is seen once marked', () => {
    markSearchTourSeen();
    expect(hasSeenSearchTour()).toBe(true);
    expect(window.localStorage.getItem('craftcheck-search-tour-seen')).toBe('1');
  });

  it('ignores any value other than "1"', () => {
    window.localStorage.setItem('craftcheck-search-tour-seen', 'true');
    expect(hasSeenSearchTour()).toBe(false);
  });

  it('never throws when localStorage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(hasSeenSearchTour()).toBe(false);
    expect(() => markSearchTourSeen()).not.toThrow();
  });
});
