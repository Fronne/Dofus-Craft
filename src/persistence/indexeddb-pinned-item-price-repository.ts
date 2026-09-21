import type { PinnedItemPrice } from '../domain/types';
import { createServerScopedPriceStore } from './server-scoped-price-store';

interface PinnedItemPriceRepository {
  get(serverId: string, itemId: string): Promise<PinnedItemPrice | undefined>;
  getMany(serverId: string, itemIds: string[]): Promise<Record<string, PinnedItemPrice>>;
  save(serverId: string, itemId: string, marketPriceKamas: number): Promise<PinnedItemPrice>;
  remove(serverId: string, itemId: string): Promise<void>;
  removeAllForItem(itemId: string): Promise<void>;
  listAllForServer(serverId: string): Promise<PinnedItemPrice[]>;
}

const store = createServerScopedPriceStore('pinned-item-prices-by-server');

export const pinnedItemPrices: PinnedItemPriceRepository = {
  async get(serverId, itemId) {
    const record = await store.get(serverId, itemId);
    return record && { itemId, marketPriceKamas: record.amountKamas, updatedAt: record.updatedAt };
  },
  async getMany(serverId, itemIds) {
    const records = await store.getMany(serverId, itemIds);
    const output: Record<string, PinnedItemPrice> = {};
    for (const [itemId, record] of Object.entries(records)) {
      output[itemId] = { itemId, marketPriceKamas: record.amountKamas, updatedAt: record.updatedAt };
    }
    return output;
  },
  async save(serverId, itemId, marketPriceKamas) {
    const record = await store.save(serverId, itemId, marketPriceKamas);
    return { itemId, marketPriceKamas: record.amountKamas, updatedAt: record.updatedAt };
  },
  async remove(serverId, itemId) {
    await store.remove(serverId, itemId);
  },
  async removeAllForItem(itemId) {
    await store.removeAllForEntry(itemId);
  },
  async listAllForServer(serverId) {
    const records = await store.listAllForServer(serverId);
    return records.map((record) => ({
      itemId: record.entryId,
      marketPriceKamas: record.amountKamas,
      updatedAt: record.updatedAt,
    }));
  },
};
