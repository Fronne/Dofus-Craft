import { beforeEach, describe, expect, it } from 'vitest';
import { getBrisageExos, setBrisageExos } from '../../src/persistence/brisage-exos';

// specs/066-exo-brisage (US4): exos kept per server and per item.
const KEY = 'craftcheck-brisage-exos';
const FO = 118, PA = 111;

beforeEach(() => window.localStorage.clear());

describe('brisage exos persistence', () => {
  it('reads back what was saved', () => {
    setBrisageExos('s1', 'item-1', [{ effectId: FO, value: 5 }, { effectId: PA, value: 1 }]);
    expect(getBrisageExos('s1', 'item-1')).toEqual([{ effectId: FO, value: 5 }, { effectId: PA, value: 1 }]);
  });

  it('keeps each item and each server apart', () => {
    setBrisageExos('s1', 'item-1', [{ effectId: FO, value: 5 }]);
    setBrisageExos('s1', 'item-2', [{ effectId: PA, value: 1 }]);
    setBrisageExos('s2', 'item-1', [{ effectId: FO, value: 9 }]);
    expect(getBrisageExos('s1', 'item-1')).toEqual([{ effectId: FO, value: 5 }]);
    expect(getBrisageExos('s1', 'item-2')).toEqual([{ effectId: PA, value: 1 }]);
    expect(getBrisageExos('s2', 'item-1')).toEqual([{ effectId: FO, value: 9 }]);
  });

  it('forgets an item when its list is emptied', () => {
    setBrisageExos('s1', 'item-1', [{ effectId: FO, value: 5 }]);
    setBrisageExos('s1', 'item-1', []);
    expect(getBrisageExos('s1', 'item-1')).toEqual([]);
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('gives no exo without a stored entry or with unreadable storage', () => {
    expect(getBrisageExos('s1', 'item-1')).toEqual([]);
    window.localStorage.setItem(KEY, '{not json');
    expect(getBrisageExos('s1', 'item-1')).toEqual([]);
    window.localStorage.setItem(KEY, '[1,2]');
    expect(getBrisageExos('s1', 'item-1')).toEqual([]);
  });

  it('drops invalid entries: wrong types, unknown stat, decimals, zero, above the weight limit, duplicates', () => {
    window.localStorage.setItem(KEY, JSON.stringify({
      's1:item-1': [
        { effectId: FO, value: 5 },
        { effectId: FO, value: 6 },
        { effectId: PA, value: 2 },
        { effectId: 123, value: 150 },
        { effectId: 123, value: 2.5 },
        { effectId: 123, value: 0 },
        { effectId: 999999, value: 1 },
        { effectId: '118', value: 1 },
        null,
        'x',
      ],
    }));
    expect(getBrisageExos('s1', 'item-1')).toEqual([{ effectId: FO, value: 5 }]);
  });
});
