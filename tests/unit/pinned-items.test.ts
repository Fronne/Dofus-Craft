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

  // 005-pinned-item-collections
  it('loads a stored entry with no collectionName field exactly as before this feature (FR-005)', () => {
    window.localStorage.setItem('craftcheck-pinned-items', JSON.stringify([{ item }]));

    expect(loadPinnedItems()).toEqual([{ item }]);
  });

  it('persists and reloads a valid collectionName', () => {
    savePinnedItems([{ item, collectionName: 'PvP' }]);

    expect(loadPinnedItems()).toEqual([{ item, collectionName: 'PvP' }]);
  });

  it('normalizes a blank or whitespace-only stored collectionName to "Sans collection" (absent)', () => {
    window.localStorage.setItem('craftcheck-pinned-items', JSON.stringify([
      { item, collectionName: '   ' },
    ]));

    expect(loadPinnedItems()).toEqual([{ item }]);
  });
});
