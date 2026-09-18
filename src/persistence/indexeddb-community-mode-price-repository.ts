import type { ResourcePrice } from '../domain/types';
import type { ResourcePriceRepository } from './resource-price-repository';
import { createServerScopedPriceStore } from './server-scoped-price-store';

const store = createServerScopedPriceStore('community-mode-prices-by-server');

// Backs the Mode communautaire carnet (spec.md FR-005): a physically separate IndexedDB store
// from `indexeddb-resource-price-repository.ts`'s Mode personnel carnet, so the two can never
// read or write each other's data.
export const communityModePrices: ResourcePriceRepository = {
  async get(serverId, resourceId) {
    const record = await store.get(serverId, resourceId);
    return record && { resourceId, unitPriceKamas: record.amountKamas, updatedAt: record.updatedAt };
  },
  async getMany(serverId, resourceIds) {
    const records = await store.getMany(serverId, resourceIds);
    const output: Record<string, ResourcePrice> = {};
    for (const [resourceId, record] of Object.entries(records)) {
      output[resourceId] = { resourceId, unitPriceKamas: record.amountKamas, updatedAt: record.updatedAt };
    }
    return output;
  },
  async save(serverId, resourceId, unitPriceKamas) {
    const record = await store.save(serverId, resourceId, unitPriceKamas);
    return { resourceId, unitPriceKamas: record.amountKamas, updatedAt: record.updatedAt };
  },
  async remove(serverId, resourceId) {
    await store.remove(serverId, resourceId);
  },
  async listAllForServer(serverId) {
    const records = await store.listAllForServer(serverId);
    return records.map((record) => ({
      resourceId: record.entryId,
      unitPriceKamas: record.amountKamas,
      updatedAt: record.updatedAt,
    }));
  },
};
