import type { ResourcePrice } from '../domain/types';

export interface ResourcePriceRepository {
  get(serverId: string, id: string): Promise<ResourcePrice | undefined>;
  getMany(serverId: string, ids: string[]): Promise<Record<string, ResourcePrice>>;
  save(serverId: string, id: string, price: number): Promise<ResourcePrice>;
  remove(serverId: string, id: string): Promise<void>;
  listAllForServer(serverId: string): Promise<ResourcePrice[]>;
}
