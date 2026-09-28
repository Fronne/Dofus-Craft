import type { ResourcePrice } from '../domain/types';

export interface ResourcePriceRepository {
  get(serverId: string, id: string): Promise<ResourcePrice | undefined>;
  getMany(serverId: string, ids: string[]): Promise<Record<string, ResourcePrice>>;
  // specs/024-latest-community-price: `updatedAt` is the date of a shared price written as is;
  // omitted, the price is dated now (a price the player typed).
  save(serverId: string, id: string, price: number, updatedAt?: string): Promise<ResourcePrice>;
  remove(serverId: string, id: string): Promise<void>;
  listAllForServer(serverId: string): Promise<ResourcePrice[]>;
}
