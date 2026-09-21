import { useEffect, useState } from 'react';
import type { ResourcePrice, ServerId } from '../../domain/types';
import { prices } from '../../persistence/indexeddb-resource-price-repository';
import type { ResourcePriceRepository } from '../../persistence/resource-price-repository';

// `repository` defaults to the Mode personnel carnet so every existing call site keeps working
// unchanged; a caller in Mode communautaire passes the community-mode carnet instead (spec.md
// FR-005 — the two carnets are strictly independent, never merged).
export function useResourcePrices(
  serverId: ServerId | undefined,
  ids: string[],
  repository: ResourcePriceRepository = prices,
) {
  const [data, setData] = useState<Record<string, ResourcePrice>>({});
  const [error, setError] = useState('');
  useEffect(() => {
    setData({});
    if (!serverId) return;
    repository.getMany(serverId, ids).then(setData).catch(() => setError('Impossible de charger les prix enregistrés.'));
  }, [serverId, ids.join(','), repository]);
  async function save(id: string, value: number) {
    if (!serverId) return;
    try {
      const price = await repository.save(serverId, id, value);
      setData((current) => ({ ...current, [id]: price }));
      setError('');
    } catch {
      setError('Impossible d’enregistrer ce prix.');
    }
  }
  async function remove(id: string) {
    if (!serverId) return;
    await repository.remove(serverId, id);
    setData((current) => {
      const { [id]: _removed, ...rest } = current;
      return rest;
    });
  }
  return { data, save, remove, error };
}
