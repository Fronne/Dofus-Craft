import { useEffect, useState } from 'react';
import { getCommunityPrice } from '../../services/community-price-api';
import type { CommunityPrice } from '../../domain/types';
import { formatKamas } from '../../domain/kamas';

// FR-013 / research.md "Fréquence de rafraîchissement du prix communautaire": refetch on mount
// (i.e. on resource/server change, since that remounts via the key prop) and every 5 minutes
// while the same resource stays displayed, never faster than that.
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

type DisplayState =
  | { kind: 'loading' }
  | { kind: 'found'; price: CommunityPrice; stale: boolean }
  | { kind: 'not-found' }
  | { kind: 'unavailable' };

function cacheKey(resourceId: string, serverId: string) {
  return `craftcheck-community-price:${serverId}:${resourceId}`;
}

// US5: the last community price successfully fetched this session, kept in sessionStorage so a
// later failure can still show it (marked stale) instead of an empty/broken state.
function readCache(resourceId: string, serverId: string): CommunityPrice | undefined {
  try {
    const raw = window.sessionStorage.getItem(cacheKey(resourceId, serverId));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<CommunityPrice>;
    if (typeof parsed.medianAmountKamas !== 'number' || typeof parsed.sampleSize !== 'number') {
      return undefined;
    }
    return { resourceId, serverId, medianAmountKamas: parsed.medianAmountKamas, sampleSize: parsed.sampleSize };
  } catch {
    return undefined;
  }
}

function writeCache(resourceId: string, serverId: string, price: CommunityPrice) {
  try {
    window.sessionStorage.setItem(cacheKey(resourceId, serverId), JSON.stringify(price));
  } catch {
    // sessionStorage unavailable — the community price just won't survive a temporary outage.
  }
}

export function CommunityPriceDisplay({ resourceId, serverId }: { resourceId: string; serverId: string }) {
  const [state, setState] = useState<DisplayState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });

    async function load() {
      const result = await getCommunityPrice(resourceId, serverId);
      if (cancelled) return;
      if (result.status === 'found') {
        writeCache(resourceId, serverId, result.price);
        setState({ kind: 'found', price: result.price, stale: false });
      } else if (result.status === 'not-found') {
        setState({ kind: 'not-found' });
      } else {
        const cached = readCache(resourceId, serverId);
        setState(cached ? { kind: 'found', price: cached, stale: true } : { kind: 'unavailable' });
      }
    }

    void load();
    const interval = window.setInterval(() => void load(), REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [resourceId, serverId]);

  return (
    <div className="community-price-display">
      {state.kind === 'loading' && <p className="muted">Prix communautaire : chargement…</p>}
      {state.kind === 'not-found' && (
        <p className="muted">Aucun prix communautaire pour cette ressource sur ce serveur pour l’instant.</p>
      )}
      {state.kind === 'unavailable' && (
        <p className="warning">Prix communautaire indisponible pour le moment.</p>
      )}
      {state.kind === 'found' && (
        <p>
          Prix communautaire : <strong>{formatKamas(state.price.medianAmountKamas)}</strong>
          {' '}(médiane sur {state.price.sampleSize} contribution{state.price.sampleSize > 1 ? 's' : ''})
          {state.stale && <span className="community-price-stale"> — peut-être daté</span>}
        </p>
      )}
    </div>
  );
}
