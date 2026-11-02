import { useEffect, useState } from 'react';
import { useActiveServer } from '../../app/ServerContext';
import { formatKamas } from '../../domain/kamas';
import { formatPriceUpdate } from '../../domain/price-update';
import type { FmContributions } from '../../domain/forgemagie';
import { getResourceDetails } from '../../data/catalogue-repository';
import { getFmContributions } from '../../services/fm-api';

// specs/082-auteur-prix-communautaires (US3): the prices the player entered — how many are still kept (prices
// are purged after 90 days) and the latest ones. Shown to the player whatever their privacy setting.
type State = { kind: 'loading' } | { kind: 'unavailable' } | { kind: 'ready'; data: FmContributions; names: Record<string, string> };

async function namesOf(ids: string[]): Promise<Record<string, string>> {
  const names: Record<string, string> = {};
  await Promise.all(ids.map(async (id) => {
    try {
      const [resource] = await getResourceDetails([id]);
      if (resource?.name) names[id] = resource.name;
    } catch {
      // The name stays the id: the price is still listed.
    }
  }));
  return names;
}

export function ContributionsSection() {
  const { servers } = useActiveServer();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await getFmContributions();
      if (cancelled) return;
      if (result.status !== 'ok') {
        setState({ kind: 'unavailable' });
        return;
      }
      setState({ kind: 'ready', data: result.data, names: {} });
      const names = await namesOf([...new Set(result.data.recent.map((row) => row.resourceId))]);
      if (!cancelled) setState({ kind: 'ready', data: result.data, names });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="profile-contributions" aria-labelledby="contributions-title">
      <h2 id="contributions-title">Mes contributions</h2>
      {state.kind === 'loading' && <p className="empty" role="status">Chargement…</p>}
      {state.kind === 'unavailable' && <p className="fm-note">Tes contributions ne sont pas disponibles pour le moment.</p>}
      {state.kind === 'ready' && state.data.total === 0 && (
        <p className="fm-note">Tu n'as encore saisi aucun prix connecté. Les prix que tu saisis sur le site apparaîtront ici.</p>
      )}
      {state.kind === 'ready' && state.data.total > 0 && (
        <>
          <p>
            <b>{state.data.total}</b> {state.data.total > 1 ? 'prix saisis' : 'prix saisi'} (gardés 90 jours).
          </p>
          <ul className="contributions-list">
            {state.data.recent.map((row, index) => (
              <li key={`${row.createdAt}-${row.resourceId}-${index}`}>
                <span>{state.names[row.resourceId] ?? row.resourceId}</span>
                <span>{formatKamas(row.amountKamas)}</span>
                <small>
                  {servers.find((server) => server.id === row.serverId)?.name ?? row.serverId} · {formatPriceUpdate(row.createdAt)}
                </small>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
