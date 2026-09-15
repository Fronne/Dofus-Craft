import { beforeEach, describe, expect, it } from 'vitest';
import { loadPinnedItems, savePinnedItems } from '../../src/persistence/pinned-items';

const item = {
  id: '1',
  name: 'Amulette du Bouftou',
  kind: 'Equipment' as const,
  categoryId: 'equipment-type-1',
};

describe('pinned items storage', () => {
  beforeEach(() => window.localStorage.clear());

  it('persists pinned item metadata, shared across all servers', () => {
    savePinnedItems([{ item }]);

    expect(loadPinnedItems()).toEqual([{ item }]);
  });

  it('ignores malformed stored entries', () => {
    window.localStorage.setItem('craftcheck-pinned-items', JSON.stringify([
      { item: { id: 'broken' } },
      { item },
    ]));

    expect(loadPinnedItems()).toEqual([{ item }]);
  });

  it('ignores a legacy, pre-migration marketPrice field on load', () => {
    window.localStorage.setItem('craftcheck-pinned-items', JSON.stringify([
      { item, marketPrice: '125000' },
    ]));

    expect(loadPinnedItems()).toEqual([{ item }]);
  });
});
