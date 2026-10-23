import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyRankingAccessFromSearch, hasRankingAccess } from '../../src/persistence/brisage-ranking-access';

// specs/072-classement-brisage (US6, FR-011, FR-012): the ranking is reserved for the owner, who opens it with
// `?classement=1` once per browser. A setting in the browser is no real authentication — it only hides the tab.
const KEY = 'craftcheck-brisage-ranking';

describe('brisage ranking access', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('is refused by default', () => {
    expect(hasRankingAccess()).toBe(false);
    expect(applyRankingAccessFromSearch('')).toEqual({ access: false, touched: false });
  });

  it('is granted by ?classement=1 and kept for the next visits', () => {
    expect(applyRankingAccessFromSearch('?classement=1')).toEqual({ access: true, touched: true });
    expect(window.localStorage.getItem(KEY)).toBe('1');
    expect(hasRankingAccess()).toBe(true);
    expect(applyRankingAccessFromSearch('')).toEqual({ access: true, touched: false });
  });

  it('is taken away by ?classement=0', () => {
    applyRankingAccessFromSearch('?classement=1');
    expect(applyRankingAccessFromSearch('?classement=0')).toEqual({ access: false, touched: true });
    expect(hasRankingAccess()).toBe(false);
  });

  it('ignores any other value and other parameters', () => {
    expect(applyRankingAccessFromSearch('?classement=oui&autre=1')).toEqual({ access: false, touched: false });
    expect(applyRankingAccessFromSearch('?autre=1')).toEqual({ access: false, touched: false });
    expect(hasRankingAccess()).toBe(false);
  });

  it('is refused when the stored value is not exactly 1', () => {
    window.localStorage.setItem(KEY, 'true');
    expect(hasRankingAccess()).toBe(false);
  });

  it('is refused, and does not throw, when the storage cannot be read or written (safe failure)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(hasRankingAccess()).toBe(false);
    expect(applyRankingAccessFromSearch('?classement=1')).toEqual({ access: false, touched: true });
  });
});
