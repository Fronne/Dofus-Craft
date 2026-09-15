import { useEffect, useState } from 'react';
import type { ResourcePrice, ServerId } from '../../domain/types';
import { prices } from '../../persistence/indexeddb-resource-price-repository';

export function useResourcePrices(serverId: ServerId | undefined, ids: string[]) {
  const [data, setData] = useState<Record<string, ResourcePrice>>({});
  const [error, setError] = useState('');
  useEffect(() => {
    setData({});
    if (!serverId) return;
    prices.getMany(serverId, ids).then(setData).catch(() => setError('Impossible de charger les prix enregistrés.'));
  }, [serverId, ids.join(',')]);
  async function save(id: string, value: number) {
    if (!serverId) return;
    try {
      const price = await prices.save(serverId, id, value);
      setData((current) => ({ ...current, [id]: price }));
      setError('');
    } catch {
      setError('Impossible d’enregistrer ce prix.');
    }
  }
  return { data, save, error };
}
