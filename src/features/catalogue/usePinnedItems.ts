import { useEffect, useState } from 'react';
import type { Item } from '../../domain/types';
import { loadPinnedItems, savePinnedItems, type PinnedItem } from '../../persistence/pinned-items';

export function usePinnedItems() {
  const [pinnedItems, setPinnedItems] = useState<PinnedItem[]>(() => loadPinnedItems());

  useEffect(() => {
    savePinnedItems(pinnedItems);
  }, [pinnedItems]);

  const isPinned = (id: string) => pinnedItems.some((entry) => entry.item.id === id);
  const pin = (item: Item) => {
    setPinnedItems((current) => {
      if (current.some((entry) => entry.item.id === item.id)) return current;
      return [...current, { item }];
    });
  };
  const unpin = (id: string) => {
    setPinnedItems((current) => current.filter((entry) => entry.item.id !== id));
  };

  return {
    pinnedItems,
    isPinned,
    pin,
    unpin,
  };
}
