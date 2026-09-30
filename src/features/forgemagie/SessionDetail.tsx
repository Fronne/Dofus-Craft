import { useEffect, useState } from 'react';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { formatFmDate, type FmItemSummary, type FmSessionDetail } from '../../domain/forgemagie';
import { formatKamas } from '../../domain/kamas';
import { getFmSession } from '../../services/fm-api';
import { PlayerBadge } from './PlayerBadge';
import { SessionStatus } from './SessionsTab';

// specs/025-rune-purchase-import (US2, FR-010): one session — who spent what, and each item bought with
// its quantity, total and average unit price, the same figures as the bot's summary.

export function ItemSummaryTable({ items }: { items: FmItemSummary[] }) {
  if (items.length === 0) return <p className="empty">Aucun achat détaillé.</p>;
  return (
    <>
      <table className="fm-items">
        <thead>
          <tr>
            <th scope="col">Objet</th>
            <th scope="col">Quantité</th>
            <th scope="col">Total</th>
            <th scope="col">Prix moyen</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.itemName}>
              <th scope="row">{item.itemName}</th>
              <td>{new Intl.NumberFormat('fr-FR').format(item.quantity)}</td>
              <td>{formatKamas(item.totalKamas)}</td>
              <td>{formatKamas(item.averageUnitKamas)}/u</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="fm-note">Prix moyen = total ÷ quantité, arrondi au kama le plus proche.</p>
    </>
  );
}

export function SessionDetail({ sessionId, onBack, onUnauthorized }: { sessionId: string; onBack: () => void; onUnauthorized: () => void }) {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'missing' | 'unavailable' } | { status: 'ready'; session: FmSessionDetail }>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void getFmSession(sessionId).then((result) => {
      if (cancelled) return;
      if (result.status === 'unauthorized') onUnauthorized();
      else if (result.status === 'ok') setState({ status: 'ready', session: result.data });
      else setState({ status: result.status === 'not-found' ? 'missing' : 'unavailable' });
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId, onUnauthorized]);

  return (
    <div className="fm-session-detail">
      <button type="button" className="btn btn-secondary btn-small fm-back" onClick={onBack}>
        <Icon name="chevron-down" size={16} className="fm-back-icon" /> Toutes les sessions
      </button>
      {state.status === 'loading' && <p className="empty" role="status">Chargement de la session…</p>}
      {state.status === 'missing' && <EmptyState icon="info" title="Session introuvable" />}
      {state.status === 'unavailable' && <EmptyState icon="info" title="Session indisponible" description="Le service ne répond pas. Réessayez plus tard." />}
      {state.status === 'ready' && (
        <>
          <h2 className="fm-section-title">
            #{state.session.channelName} <SessionStatus session={state.session} />
          </h2>
          <p className="fm-session-dates">
            Ouverte le {formatFmDate(state.session.openedAt)}
            {state.session.closedAt ? ` · fermée le ${formatFmDate(state.session.closedAt)}` : ''}
          </p>
          <p className="fm-total">Total : <strong>{formatKamas(state.session.totalKamas)}</strong></p>

          <h3 className="fm-subtitle">Dépense par joueur</h3>
          <ul className="fm-spend-list">
            {state.session.players.map((row, index) => (
              <li key={row.player.discordUserId ?? `private-${index}`}>
                <PlayerBadge player={row.player} />
                <span className="fm-amount">{formatKamas(row.spentKamas)}</span>
              </li>
            ))}
          </ul>

          <h3 className="fm-subtitle">Achats</h3>
          <ItemSummaryTable items={state.session.items} />
        </>
      )}
    </div>
  );
}
