import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readHistoryGrouping, saveHistoryGrouping } from '../../src/persistence/history-grouping-preference';

// specs/018-price-history-windows FR-002 (specs/017 FR-007).
describe('history grouping preference (specs/017)', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('defaults to the week', () => {
    expect(readHistoryGrouping()).toBe('week');
  });

  it('reads back a saved grouping', () => {
    saveHistoryGrouping('month');
    expect(readHistoryGrouping()).toBe('month');
  });

  it('falls back to the week on an unknown value', () => {
    window.localStorage.setItem('craftcheck-history-grouping', 'year');
    expect(readHistoryGrouping()).toBe('week');
  });

  it('never throws when localStorage does', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => saveHistoryGrouping('day')).not.toThrow();
    expect(readHistoryGrouping()).toBe('week');
  });
});
