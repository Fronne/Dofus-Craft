import { useEffect, useState } from 'react';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { fmItemDisplayName, formatFmDate, type FmItemSummary, type FmMe, type FmOwnedItem, type FmSessionDetail, type FmSessionItem } from '../../domain/forgemagie';
import { formatKamas } from '../../domain/kamas';
import { attachFmSession, detachFmSession, getFmPlayer, getFmSession } from '../../services/fm-api';
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

/** « Rtograf PA (Cyril) », or the masked item of a private player (specs/027 FR-008). */
export function sessionItemLabel(item: FmSessionItem): string {
  return 'private' in item ? 'objet d\u2019un joueur privé' : `${item.name} (${item.owner.displayName ?? 'Joueur privé'})`;
}

const ATTACH_ERRORS: Record<string, string> = {
  'already-attached': 'Cette session vient d\u2019être rattachée à un autre objet.',
  'not-participant': 'Tu ne peux rattacher que les sessions où tu as dépensé.',
};

// specs/027-fm-item-recap (US1): which item the session goes to, and attaching or detaching it.
function SessionItem({ session, me, onChanged, onGoToProfile }: {
  session: FmSessionDetail;
  me: FmMe;
  onChanged: (session: FmSessionDetail) => void;
  onGoToProfile: () => void;
}) {
  const [myItems, setMyItems] = useState<FmOwnedItem[] | undefined>(undefined);
  const [chosen, setChosen] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!session.canAttach) return;
    let cancelled = false;
    void getFmPlayer(me.discordUserId).then((result) => {
      if (cancelled || result.status !== 'ok') return;
      setMyItems(result.data.fmItems);
      setChosen(result.data.fmItems[0]?.id ?? '');
    });
    return () => {
      cancelled = true;
    };
  }, [session.canAttach, me.discordUserId]);

  const act = async (action: () => ReturnType<typeof detachFmSession>) => {
    setBusy(true);
    setError(undefined);
    const result = await action();
    setBusy(false);
    if (result.status === 'ok') onChanged(result.data);
    else setError((result.status === 'error' && result.code && ATTACH_ERRORS[result.code]) || 'L\u2019opération a échoué. Réessaie.');
  };

  return (
    <div className="fm-session-item">
      <p>
        Objet : {session.fmItem ? <b>{sessionItemLabel(session.fmItem)}</b> : <span className="fm-note">non rattachée</span>}
      </p>
      {session.canDetach && (
        <button type="button" className="btn btn-secondary btn-small" disabled={busy} onClick={() => void act(() => detachFmSession(session.id))}>
          Détacher
        </button>
      )}
      {session.canAttach && myItems && myItems.length === 0 && (
        <button type="button" className="btn btn-secondary btn-small" onClick={onGoToProfile}>Créer un objet en FM</button>
      )}
      {session.canAttach && myItems && myItems.length > 0 && (
        <span className="fm-attach">
          <select className="hdv-type-filter" value={chosen} onChange={(event) => setChosen(event.target.value)} aria-label="Objet à rattacher">
            {myItems.map((item) => <option key={item.id} value={item.id}>{fmItemDisplayName(item)}</option>)}
          </select>
          <button type="button" className="btn btn-primary btn-small" disabled={busy || !chosen} onClick={() => void act(() => attachFmSession(session.id, chosen))}>
            Rattacher
          </button>
        </span>
      )}
      {error && <p className="fm-error" role="alert">{error}</p>}
    </div>
  );
}

export function SessionDetail({ sessionId, me, onBack, onUnauthorized, onGoToProfile }: {
  sessionId: string;
  me: FmMe;
  onBack: () => void;
  onUnauthorized: () => void;
  onGoToProfile: () => void;
}) {
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
          <SessionItem
            session={state.session}
            me={me}
            onChanged={(session) => setState({ status: 'ready', session })}
            onGoToProfile={onGoToProfile}
          />
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
