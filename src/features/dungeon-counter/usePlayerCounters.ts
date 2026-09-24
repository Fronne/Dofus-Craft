import { useEffect, useState } from 'react';
import type { PlayerCounter } from '../../domain/player-counter';
import { getPlayerCounters } from '../../services/player-counters-api';
import { readCachedCounters, writeCachedCounters } from '../../persistence/player-counters-cache';

// specs/014-admin-counters (FR-001, FR-004): the counters now live in the shared database. The last
// list received is shown right away and whenever the service can't be reached.
export function usePlayerCounters(): PlayerCounter[] {
  const [counters, setCounters] = useState<PlayerCounter[]>(() => readCachedCounters());

  useEffect(() => {
    let cancelled = false;
    void getPlayerCounters().then((result) => {
      if (cancelled || result.status !== 'ok') return;
      writeCachedCounters(result.counters);
      setCounters(result.counters);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return counters;
}
