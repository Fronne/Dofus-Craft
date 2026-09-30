import { useCallback, useEffect, useState } from 'react';
import { EmptyState } from '../../components/EmptyState';
import { formatFmDate, type FmSession } from '../../domain/forgemagie';
import { formatKamas } from '../../domain/kamas';
import { getFmSessions } from '../../services/fm-api';
import { PlayerBadge } from './PlayerBadge';

// specs/025-rune-purchase-import (US2, FR-010): the FM sessions the Discord bot sent, most recent first.

export function SessionStatus({ session }: { session: Pick<FmSession, 'status'> }) {
  return (
    <span className={`fm-status fm-status--${session.status}`}>{session.status === 'open' ? 'En cours' : 'Terminée'}</span>
  );
}

export function SessionsTab({ onOpen, onUnauthorized }: { onOpen: (sessionId: string) => void; onUnauthorized: () => void }) {
  const [sessions, setSessions] = useState<FmSession[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (before: string | null) => {
    const result = await getFmSessions(before);
    if (result.status === 'unauthorized') {
      onUnauthorized();
      return;
    }
    if (result.status !== 'ok') {
      if (!before) setState('unavailable');
      return;
    }
    setSessions((current) => (before ? [...current, ...result.data.sessions] : result.data.sessions));
    setNextBefore(result.data.nextBefore);
    setState('ready');
  }, [onUnauthorized]);

  useEffect(() => {
    void load(null);
  }, [load]);

  if (state === 'loading') return <p className="empty" role="status">Chargement des sessions…</p>;
  if (state === 'unavailable') {
    return <EmptyState icon="info" title="Sessions indisponibles" description="Le service ne répond pas. Réessayez plus tard." />;
  }
  if (sessions.length === 0) {
    return <EmptyState icon="anvil" title="Aucune session pour l'instant" description="Lancez /fmstart dans Discord : la session du bot apparaîtra ici." />;
  }

  return (
    <>
      <ul className="fm-session-list">
        {sessions.map((session) => (
          <li key={session.id}>
            <button type="button" className="fm-session-card" onClick={() => onOpen(session.id)}>
              <span className="fm-session-head">
                <span className="fm-session-channel">#{session.channelName}</span>
                <SessionStatus session={session} />
              </span>
              <span className="fm-session-date">{formatFmDate(session.openedAt)}</span>
              <span className="fm-session-total">{formatKamas(session.totalKamas)}</span>
              <span className="fm-session-players">
                {session.players.map((row, index) => (
                  <span key={row.player.discordUserId ?? `private-${index}`} className="fm-session-player">
                    <PlayerBadge player={row.player} />
                    <span className="fm-amount">{formatKamas(row.spentKamas)}</span>
                  </span>
                ))}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {nextBefore && (
        <button
          type="button"
          className="btn btn-secondary fm-load-more"
          disabled={loadingMore}
          onClick={async () => {
            setLoadingMore(true);
            await load(nextBefore);
            setLoadingMore(false);
          }}
        >
          {loadingMore ? 'Chargement…' : 'Charger plus'}
        </button>
      )}
    </>
  );
}
