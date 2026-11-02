import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyBonsPlansAccessFromSearch, hasBonsPlansAccess, withoutBonsPlansParameter } from '../../src/persistence/bons-plans-access';

// specs/081-bons-plans-aide-acces (US2): the owner opens the page in a browser with `?bonsplans=1`, once.
const KEY = 'dofus-craft-bons-plans-access';

describe('bons plans access', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('is refused by default', () => {
    expect(hasBonsPlansAccess()).toBe(false);
    expect(applyBonsPlansAccessFromSearch('')).toEqual({ access: false, touched: false });
  });

  it('is granted by ?bonsplans=1 and kept for the next visits', () => {
    expect(applyBonsPlansAccessFromSearch('?bonsplans=1')).toEqual({ access: true, touched: true });
    expect(window.localStorage.getItem(KEY)).toBe('1');
    expect(applyBonsPlansAccessFromSearch('')).toEqual({ access: true, touched: false });
  });

  it('is taken away by ?bonsplans=0', () => {
    applyBonsPlansAccessFromSearch('?bonsplans=1');
    expect(applyBonsPlansAccessFromSearch('?bonsplans=0')).toEqual({ access: false, touched: true });
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('ignores any other value', () => {
    expect(applyBonsPlansAccessFromSearch('?bonsplans=oui')).toEqual({ access: false, touched: false });
  });

  it('stays refused when the browser refuses to store', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    expect(applyBonsPlansAccessFromSearch('?bonsplans=1')).toEqual({ access: false, touched: true });
  });

  it('takes only its parameter off the address', () => {
    expect(withoutBonsPlansParameter({ pathname: '/bons-plans', search: '?bonsplans=1', hash: '' })).toBe('/bons-plans');
    expect(withoutBonsPlansParameter({ pathname: '/', search: '?a=1&bonsplans=1', hash: '#b' })).toBe('/?a=1#b');
  });
});
