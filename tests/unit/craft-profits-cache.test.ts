import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { keepCraftProfits, readKeptCraftProfits } from '../../src/persistence/craft-profits-cache';
import type { CraftProfitRow } from '../../src/domain/craft-profit';

const row: CraftProfitRow = {
  item: { id: 'i1', name: 'Anneau' },
  marketPriceKamas: 13000,
  marketPriceDate: '2026-10-13T10:00:00.000Z',
  craftCostKamas: 10000,
  profitKamas: 3000,
  marginPercent: 30,
};
const now = () => new Date().toISOString();

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('liste Rentabilité gardée (specs/054)', () => {
  it('reads back the list kept for the same server and mode', () => {
    const computedAt = now();
    keepCraftProfits('mikhal', 'personal', [row], computedAt);
    expect(readKeptCraftProfits('mikhal', 'personal')).toEqual({ computedAt, rows: [row] });
  });

  it('never mixes servers or modes', () => {
    keepCraftProfits('mikhal', 'personal', [row], now());
    expect(readKeptCraftProfits('mikhal', 'community')).toBeUndefined();
    expect(readKeptCraftProfits('other', 'personal')).toBeUndefined();
  });

  it('keeps an empty list', () => {
    keepCraftProfits('mikhal', 'personal', [], now());
    expect(readKeptCraftProfits('mikhal', 'personal')?.rows).toEqual([]);
  });

  it('ignores a list in another format', () => {
    window.localStorage.setItem('craftcheck-craft-profits:mikhal:personal', JSON.stringify({ formatVersion: 99, computedAt: now(), rows: [row] }));
    expect(readKeptCraftProfits('mikhal', 'personal')).toBeUndefined();
  });

  it('ignores a list older than 7 days', () => {
    keepCraftProfits('mikhal', 'personal', [row], new Date(Date.now() - 8 * 86_400_000).toISOString());
    expect(readKeptCraftProfits('mikhal', 'personal')).toBeUndefined();
  });

  it('keeps a list of 6 days', () => {
    keepCraftProfits('mikhal', 'personal', [row], new Date(Date.now() - 6 * 86_400_000).toISOString());
    expect(readKeptCraftProfits('mikhal', 'personal')?.rows).toHaveLength(1);
  });

  it('ignores a malformed row or date', () => {
    window.localStorage.setItem('craftcheck-craft-profits:mikhal:personal', JSON.stringify({ formatVersion: 1, computedAt: now(), rows: [{ item: { id: 'i1' } }] }));
    expect(readKeptCraftProfits('mikhal', 'personal')).toBeUndefined();
    window.localStorage.setItem('craftcheck-craft-profits:mikhal:personal', JSON.stringify({ formatVersion: 1, computedAt: 'hier', rows: [row] }));
    expect(readKeptCraftProfits('mikhal', 'personal')).toBeUndefined();
    window.localStorage.setItem('craftcheck-craft-profits:mikhal:personal', '{pas du json');
    expect(readKeptCraftProfits('mikhal', 'personal')).toBeUndefined();
  });

  it('ignores a row whose HDV date or amounts are not usable', () => {
    for (const bad of [{ ...row, marketPriceDate: undefined }, { ...row, marketPriceDate: 'hier' }, { ...row, profitKamas: null }, { ...row, marginPercent: 'beaucoup' }]) {
      window.localStorage.setItem('craftcheck-craft-profits:mikhal:personal', JSON.stringify({ formatVersion: 1, computedAt: now(), rows: [bad] }));
      expect(readKeptCraftProfits('mikhal', 'personal')).toBeUndefined();
    }
    const withoutMargin: CraftProfitRow = { ...row };
    delete withoutMargin.marginPercent;
    keepCraftProfits('mikhal', 'personal', [withoutMargin], now());
    expect(readKeptCraftProfits('mikhal', 'personal')?.rows).toEqual([withoutMargin]);
  });

  it('ignores a list dated in the future', () => {
    keepCraftProfits('mikhal', 'personal', [row], new Date(Date.now() + 3_600_000).toISOString());
    expect(readKeptCraftProfits('mikhal', 'personal')).toBeUndefined();
  });

  it('works without usable storage', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    expect(() => keepCraftProfits('mikhal', 'personal', [row], now())).not.toThrow();
    expect(readKeptCraftProfits('mikhal', 'personal')).toBeUndefined();
  });
});
