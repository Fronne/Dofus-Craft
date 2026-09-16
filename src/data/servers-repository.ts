import { cached } from './catalogue-cache';
import { getDofusDbServers } from '../services/dofusdb-api';
import { mapDofusDbServers } from '../services/dofusdb-mappers';
import type { Server } from '../domain/servers';

export async function getServers(): Promise<Server[]> {
  return cached('servers', async () => mapDofusDbServers(await getDofusDbServers()));
}
