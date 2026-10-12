import { useEffect, useState } from 'react';
import { EmptyState } from '../../components/EmptyState';
import { formatFmDate, type FmGroupPlayer, type FmGroupSeance } from '../../domain/forgemagie';
import { getFmPlayers } from '../../services/fm-api';
import { Kamas } from '../prices/PricesPage';
import { FmItemIcon } from './FmItemIcon';
import { PlayerBadge } from './PlayerBadge';
import { FoldChevron } from './SeanceSessions';
import { SeanceStatus, sessionCountLabel } from './SeancesTab';

// specs/049-fm-seances (US4): what forgemagie cost each player of the group. A public player's séances
// are listed — name, item, state, total — never their sessions, captures or runes.

function PlayerSeance({ seance }: { seance: FmGroupSeance }) {
  return (
    <div className="fm-session-card fm-seance-card fm-player-seance">
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
    </div>
  );
}

function PlayerCard({ player, foldable }: { player: FmGroupPlayer; foldable: boolean }) {
  const count = `${player.seanceCount} ${player.seanceCount > 1 ? 'séances' : 'séance'}`;
  return (
    <>
      <span className="fm-seance-card-text">
        <span className="fm-session-head">
          <PlayerBadge player={{ discordUserId: null, displayName: player.displayName, avatarUrl: player.avatarUrl, private: player.private }} />
          {player.isMe && <span className="fm-status fm-status--paused">toi</span>}
        </span>
        <span className="fm-session-date">
          {count}
          {player.lastActivityAt && ` · dernière activité le ${formatFmDate(player.lastActivityAt)}`}
          {player.private && ' · profil privé : visible de toi seul'}
        </span>
      </span>
      <span className="fm-session-total"><Kamas value={player.totalKamas} /></span>
      {foldable && <FoldChevron className="fm-player-chevron" />}
    </>
  );
}

export function PlayersTab({ onUnauthorized }: { onUnauthorized: () => void }) {
  const [state, setState] = useState<{ status: 'loading' | 'unavailable' } | { status: 'ready'; players: FmGroupPlayer[] }>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void getFmPlayers().then((result) => {
      if (cancelled) return;
      if (result.status === 'unauthorized') onUnauthorized();
      else if (result.status === 'ok') setState({ status: 'ready', players: result.data });
      else setState({ status: 'unavailable' });
    });
    return () => {
      cancelled = true;
    };
  }, [onUnauthorized]);

  if (state.status === 'loading') return <p className="empty" role="status">Chargement des joueurs…</p>;
  if (state.status !== 'ready') {
    return <EmptyState icon="info" title="Joueurs indisponibles" description="Le service ne répond pas. Réessayez plus tard." />;
  }
  if (state.players.length === 0) {
    return (
      <EmptyState
        icon="users"
        title="Personne n'a encore fait de FM"
        description="Les joueurs du groupe apparaîtront ici avec ce que leurs séances de FM ont coûté."
      />
    );
  }

  return (
    <>
      <p className="fm-note fm-players-note">
        Ce que la forgemagie a coûté à chaque joueur du groupe. Clique sur un joueur pour voir ses séances de FM. Un joueur dont le
        profil est privé n'apparaît pas.
      </p>
      <ul className="fm-session-list">
        {state.players.map((player, index) => (
          <li key={`${player.displayName}-${index}`}>
            {player.seances.length === 0 ? (
              <div className="fm-session-card fm-player-card"><PlayerCard player={player} foldable={false} /></div>
            ) : (
              <details className="fm-player-fold">
                <summary className="fm-session-card fm-player-card"><PlayerCard player={player} foldable /></summary>
                <ul className="fm-session-list fm-player-seances" aria-label={`Séances de FM de ${player.displayName}`}>
                  {player.seances.map((seance, seanceIndex) => <li key={`${seance.name}-${seanceIndex}`}><PlayerSeance seance={seance} /></li>)}
                </ul>
              </details>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
