import { useEffect, useRef, useState } from 'react';
import type { ResourcePrice, ServerId } from '../../domain/types';
import { prices } from '../../persistence/indexeddb-resource-price-repository';
import type { ResourcePriceRepository } from '../../persistence/resource-price-repository';

// `repository` defaults to the Mode personnel carnet so every existing call site keeps working
// unchanged; a caller in Mode communautaire passes the community-mode carnet instead (spec.md
// FR-005 — the two carnets are strictly independent, never merged).
//
// specs/010-search-instant-cache, FR-009/T009: this carnet is already fully local (IndexedDB), so
// there is no separate "cache vs network" distinction to make here — the fix is simply to never
// flash back to an empty `data` while the read for the new serverId/ids/repository is in flight
// (a resourceId shared between two items' recipes should keep showing its already-known price
// immediately, not blink to empty), and to guard against a slower, now-stale read overwriting a
// more recent one via a generation counter, the same anti-race pattern as
// src/data/use-stale-while-revalidate.ts.
export function useResourcePrices(
  serverId: ServerId | undefined,
  ids: string[],
  repository: ResourcePriceRepository = prices,
) {
  const [data, setData] = useState<Record<string, ResourcePrice>>({});
  const [error, setError] = useState('');
  // specs/010-search-instant-cache: exposes whether the *current* serverId/ids/repository
  // combination has actually finished its first read. A caller deciding whether to prefill an
  // empty-looking slot (e.g. CommunityResourcePriceRow in RecherchePage) MUST wait for this to be
  // true before trusting `data[id] === undefined` as "genuinely no carnet entry" rather than
  // "haven't checked yet" — skipping that check is exactly what let a stale community median
  // overwrite an already-persisted price on a remount race (FR-006 of specs/004).
  const [loaded, setLoaded] = useState(false);
  const generationRef = useRef(0);
  useEffect(() => {
    generationRef.current += 1;
    const generation = generationRef.current;
    setLoaded(false);
    if (!serverId) {
      setData({});
      setLoaded(true);
      return;
    }
    repository
      .getMany(serverId, ids)
      .then((result) => {
        if (generationRef.current !== generation) return;
        setData(result);
        setLoaded(true);
      })
      .catch(() => {
        if (generationRef.current !== generation) return;
        setError('Impossible de charger les prix enregistrés.');
        setLoaded(true);
      });
  }, [serverId, ids.join(','), repository]);
  async function save(id: string, value: number, updatedAt?: string) {
    if (!serverId) return;
    try {
      const price = await repository.save(serverId, id, value, updatedAt);
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
      const rest = { ...current };
      delete rest[id];
      return rest;
    });
  }
  return { data, save, remove, error, loaded };
}
