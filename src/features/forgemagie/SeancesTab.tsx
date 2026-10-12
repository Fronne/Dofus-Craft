import { useCallback, useEffect, useState } from 'react';
import { EmptyState } from '../../components/EmptyState';
import { formatFmDate, SEANCE_STATE_LABELS, type FmMe, type FmSeance, type FmSeanceState } from '../../domain/forgemagie';
import { getFmSeances } from '../../services/fm-api';
import { Kamas } from '../prices/PricesPage';
import { FmItemIcon } from './FmItemIcon';
import { StartSeance } from './StartSeance';

// specs/049-fm-seances (US1): the player's séances de FM — their private channels — most recent first,
// with what each one cost. Only one's own séances are listed.

/** While a séance is running, the list is reread at the bot's pace. */
export const SEANCE_REFRESH_MS = 10_000;

export function SeanceStatus({ state }: { state: FmSeanceState }) {
  return <span className={`fm-status fm-status--${state}`}>{SEANCE_STATE_LABELS[state]}</span>;
}

export function sessionCountLabel(count: number): string {
  return `${count} ${count > 1 ? 'sessions' : 'session'}`;
}

function SeanceCard({ seance, onOpen }: { seance: FmSeance; onOpen: (seanceId: string) => void }) {
  return (
    <button type="button" className="fm-session-card fm-seance-card" onClick={() => onOpen(seance.id)}>
      {seance.fmItem && <FmItemIcon imageUrl={seance.fmItem.imageUrl} />}
      <span className="fm-seance-card-text">
        <span className="fm-session-head">
          <span className="fm-session-channel">{seance.fmItem ? seance.fmItem.name : `#${seance.name}`}</span>
          <SeanceStatus state={seance.state} />
        </span>
        <span className="fm-session-date">
          {seance.fmItem && `#${seance.name} · `}
          {sessionCountLabel(seance.sessionCount)} · dernière activité le {formatFmDate(seance.lastActivityAt)}
        </span>
      </span>
      <span className="fm-session-total"><Kamas value={seance.totalKamas} /></span>
    </button>
  );
}

export function SeancesTab({ me, onOpen, onUnauthorized }: { me: FmMe; onOpen: (seanceId: string) => void; onUnauthorized: () => void }) {
  const [seances, setSeances] = useState<FmSeance[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading');

  const load = useCallback(async (first: boolean) => {
    const result = await getFmSeances();
    if (result.status === 'unauthorized') {
      onUnauthorized();
      return;
    }
    if (result.status !== 'ok') {
      // A failed reread keeps what is shown; only the first read reports an error.
      if (first) setState('unavailable');
      return;
    }
    setSeances(result.data);
    setState('ready');
  }, [onUnauthorized]);

  useEffect(() => {
    void load(true);
  }, [load]);

  const running = seances.some((seance) => seance.state === 'running');
  useEffect(() => {
    if (!running) return;
    const reread = () => {
      if (document.visibilityState === 'visible') void load(false);
    };
    const timer = window.setInterval(reread, SEANCE_REFRESH_MS);
    document.addEventListener('visibilitychange', reread);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', reread);
    };
  }, [running, load]);

  if (state === 'loading') return <p className="empty" role="status">Chargement des séances de FM…</p>;
  if (state === 'unavailable') {
    return <EmptyState icon="info" title="Séances de FM indisponibles" description="Le service ne répond pas. Réessayez plus tard." />;
  }

  // Once the bot created the channel, the new séance opens right away.
  const start = <StartSeance me={me} onCreated={onOpen} />;
  if (seances.length === 0) {
    return (
      <>
        {start}
        <EmptyState
          icon="hammer"
          title="Aucune séance de FM pour l'instant"
          description="Crée ta première séance de FM ici, ou avec le bouton « Nouvelle séance de FM » dans Discord : elle aura son salon, où tu posteras tes captures."
        />
      </>
    );
  }

  return (
    <>
      {start}
      <ul className="fm-session-list">
        {seances.map((seance) => <li key={seance.id}><SeanceCard seance={seance} onOpen={onOpen} /></li>)}
      </ul>
    </>
  );
}
