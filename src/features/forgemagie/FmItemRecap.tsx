import { useEffect, useState } from 'react';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { fmItemDisplayName, formatFmDate, type FmItemRecap as Recap } from '../../domain/forgemagie';
import { formatKamas } from '../../domain/kamas';
import { getFmItem } from '../../services/fm-api';
import { FmItemIcon } from './FmItemsSection';
import { PlayerBadge } from './PlayerBadge';
import { ItemSummaryTable } from './SessionDetail';
import { SessionStatus } from './SessionsTab';

// specs/027-fm-item-recap (US2, FR-009 to FR-012): what an item in FM cost — total, attached sessions,
// per-rune detail over all of them. No share per player.

export function FmItemRecap({ itemId, onBack, onOpenSession, onUnauthorized }: {
  itemId: string;
  onBack: () => void;
  onOpenSession: (sessionId: string) => void;
  onUnauthorized: () => void;
}) {
  const [state, setState] = useState<{ status: 'loading' | 'missing' | 'unavailable' } | { status: 'ready'; recap: Recap }>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void getFmItem(itemId).then((result) => {
      if (cancelled) return;
      if (result.status === 'unauthorized') onUnauthorized();
      else if (result.status === 'ok') setState({ status: 'ready', recap: result.data });
      else setState({ status: result.status === 'not-found' ? 'missing' : 'unavailable' });
    });
    return () => {
      cancelled = true;
    };
  }, [itemId, onUnauthorized]);

  return (
    <div className="fm-item-recap">
      <button type="button" className="btn btn-secondary btn-small fm-back" onClick={onBack}>
        <Icon name="chevron-down" size={16} className="fm-back-icon" /> Retour au profil
      </button>
      {state.status === 'loading' && <p className="empty" role="status">Chargement du récap…</p>}
      {state.status === 'missing' && <EmptyState icon="info" title="Objet introuvable" description="Il a peut-être été supprimé, ou son propriétaire a passé son profil en privé." />}
      {state.status === 'unavailable' && <EmptyState icon="info" title="Récap indisponible" description="Le service ne répond pas. Réessayez plus tard." />}
      {state.status === 'ready' && (
        <>
          <h2 className="fm-section-title">
            <FmItemIcon imageUrl={state.recap.imageUrl} /> {fmItemDisplayName(state.recap)}
          </h2>
          <p className="fm-session-dates">
            {state.recap.label && <>{state.recap.itemName} · </>}
            <PlayerBadge player={state.recap.owner} />
          </p>
          <p className="fm-total">Total dépensé : <strong>{formatKamas(state.recap.totalKamas)}</strong></p>

          <h3 className="fm-subtitle">Sessions</h3>
          {state.recap.sessions.length === 0 ? (
            <p className="fm-note">Aucune session rattachée. Ouvre une session où tu as dépensé et rattache-la à cet objet.</p>
          ) : (
            <ul className="fm-spend-list">
              {state.recap.sessions.map((session) => (
                <li key={session.id}>
                  <button type="button" className="fm-link" onClick={() => onOpenSession(session.id)}>
                    #{session.channelName} · {formatFmDate(session.openedAt)}
                  </button>
                  <SessionStatus session={session} />
                  <span className="fm-amount">{formatKamas(session.totalKamas)}</span>
                </li>
              ))}
            </ul>
          )}

          <h3 className="fm-subtitle">Achats</h3>
          <ItemSummaryTable items={state.recap.items} />
        </>
      )}
    </div>
  );
}
