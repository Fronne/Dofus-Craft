import { useCallback, useEffect, useRef, useState } from 'react';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { StatTile } from '../../components/StatTile';
import { formatFmDate, isRuneName, type FmMe, type FmSeanceDetail, type FmSeanceRequest } from '../../domain/forgemagie';
import { formatKamas } from '../../domain/kamas';
import type { PriceMode } from '../../domain/price-modes';
import {
  archiveFmSeance, getFmSeance, reopenFmSeance, resendFmSession, startFmSession, stopFmSession, type FmResult,
} from '../../services/fm-api';
import { CaptureImport } from './CaptureImport';
import { PurchasesTable } from './PurchasesTable';
import { SeanceItem } from './SeanceItem';
import { SeanceSessions } from './SeanceSessions';
import { SEANCE_REFRESH_MS, SeanceStatus } from './SeancesTab';

// specs/049-fm-seances (US1, US2): one séance de FM — what it cost, what was bought, its sessions and
// their captures — and what its owner can do with it: stop or resume a session, archive or reopen it.

const quantityFormat = new Intl.NumberFormat('fr-FR');

const ACTION_ERRORS: Record<string, string> = {
  'channel-limit': 'Tu as déjà 5 séances de FM non archivées : archives-en une avant de rouvrir celle-ci.',
  'channel-busy': 'Une session est déjà ouverte dans cette séance.',
  'not-open': 'Cette session est déjà arrêtée.',
};

function requestMessage(request: FmSeanceRequest): string {
  const what = request.type === 'archive' ? 'L’archivage du salon' : 'La réouverture du salon';
  if (request.status === 'failed') return `${what} a échoué dans Discord${request.error ? ` : ${request.error}` : '.'}`;
  if (request.status === 'stale') return `${what} n’est pas encore fait dans Discord : le bot ne répond pas.`;
  return `${what} est demandé à Discord…`;
}

type State = { status: 'loading' | 'missing' | 'unavailable' } | { status: 'ready'; seance: FmSeanceDetail };

export function SeanceDetail({ seanceId, me, priceMode, onBack, onUnauthorized }: {
  seanceId: string;
  me: FmMe;
  priceMode: PriceMode;
  onBack: () => void;
  onUnauthorized: () => void;
}) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const archiveDialog = useRef<HTMLDialogElement>(null);
  // Counts what was shown: an answer older than the last change is dropped.
  const version = useRef(0);

  const show = useCallback((seance: FmSeanceDetail) => {
    version.current += 1;
    setState({ status: 'ready', seance });
  }, []);

  const load = useCallback(async (first: boolean) => {
    const asked = version.current;
    const result = await getFmSeance(seanceId);
    if (asked !== version.current) return;
    if (result.status === 'unauthorized') onUnauthorized();
    else if (result.status === 'ok') show(result.data);
    // A failed reread keeps what is shown; only the first read reports an error.
    else if (first) setState({ status: result.status === 'not-found' ? 'missing' : 'unavailable' });
  }, [seanceId, onUnauthorized, show]);

  useEffect(() => {
    void load(true);
  }, [load]);

  const seance = state.status === 'ready' ? state.seance : undefined;
  const live = seance !== undefined && (seance.state === 'running' || seance.request?.status === 'pending');
  useEffect(() => {
    if (!live) return;
    const reread = () => {
      if (document.visibilityState === 'visible') void load(false);
    };
    const timer = window.setInterval(reread, SEANCE_REFRESH_MS);
    document.addEventListener('visibilitychange', reread);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', reread);
    };
  }, [live, load]);

  const act = async (action: () => Promise<FmResult<FmSeanceDetail | { id: string }>>) => {
    setBusy(true);
    setError(undefined);
    const result = await action();
    setBusy(false);
    archiveDialog.current?.close();
    if (result.status === 'unauthorized') {
      onUnauthorized();
    } else if (result.status === 'ok') {
      // Archiving and reopening answer with the séance; the session routes only with the session.
      if ('sessions' in result.data) show(result.data);
      else {
        version.current += 1;
        await load(false);
      }
    } else {
      setError((result.status === 'error' && result.code && ACTION_ERRORS[result.code]) || 'L’opération a échoué. Réessaie.');
    }
  };

  const back = (
    <button type="button" className="btn btn-secondary btn-small fm-back" onClick={onBack}>
      <Icon name="chevron-down" size={16} className="fm-back-icon" /> Toutes les séances de FM
    </button>
  );

  if (!seance) {
    return (
      <div className="fm-session-detail">
        {back}
        {state.status === 'loading' && <p className="empty" role="status">Chargement de la séance de FM…</p>}
        {state.status === 'missing' && <EmptyState icon="info" title="Séance de FM introuvable" />}
        {state.status === 'unavailable' && <EmptyState icon="info" title="Séance de FM indisponible" description="Le service ne répond pas. Réessayez plus tard." />}
      </div>
    );
  }

  const openSession = seance.sessions.find((session) => session.status === 'open');
  const canResend = openSession !== undefined && openSession.sync != null && ['stale', 'failed'].includes(openSession.sync.status);
  const onlyRunes = seance.items.every((item) => isRuneName(item.itemName));
  const reload = () => {
    version.current += 1;
    void load(false);
  };

  return (
    <div className="fm-session-detail">
      {back}
      <div className="fm-detail-head">
        <h2 className="fm-section-title">#{seance.name} <SeanceStatus state={seance.state} /></h2>
        <div className="fm-detail-actions">
          {canResend && (
            <button type="button" className="btn btn-secondary btn-small" disabled={busy} onClick={() => void act(() => resendFmSession(openSession.id))}>Relancer</button>
          )}
          {openSession?.canStop && (
            <button type="button" className="btn btn-secondary btn-small" disabled={busy} onClick={() => void act(() => stopFmSession(openSession.id))}>Arrêter la session</button>
          )}
          {seance.canResume && (
            <button type="button" className="btn btn-primary btn-small" disabled={busy} onClick={() => void act(() => startFmSession(seance.id))}>Reprendre</button>
          )}
          {seance.canArchive && (
            <button type="button" className="btn btn-secondary btn-small fm-delete" disabled={busy} onClick={() => archiveDialog.current?.showModal()}>Archiver la séance</button>
          )}
          {seance.canReopen && (
            <button type="button" className="btn btn-primary btn-small" disabled={busy} onClick={() => void act(() => reopenFmSeance(seance.id))}>Rouvrir</button>
          )}
        </div>
      </div>
      <p className="fm-session-dates fm-detail-meta">
        Créée le {formatFmDate(seance.createdAt)} · dernière activité le {formatFmDate(seance.lastActivityAt)}
      </p>
      {seance.request && <p className={seance.request.status === 'pending' ? 'fm-note' : 'fm-error'} role="status">{requestMessage(seance.request)}</p>}
      {error && <p className="fm-error" role="alert">{error}</p>}

      <SeanceItem seance={seance} me={me} onChanged={show} onRenamed={reload} />

      {openSession && (
        <CaptureImport me={me} priceMode={priceMode} sessionId={openSession.id} onImported={reload} onSessionClosed={reload} />
      )}

      <div className="stat-tile-row fm-detail-stats">
        <StatTile icon="coins" label="Total dépensé" value={formatKamas(seance.totalKamas)} />
        <StatTile icon="package" label={onlyRunes ? 'Runes achetées' : 'Objets achetés'} value={quantityFormat.format(seance.quantity)} />
        <StatTile icon="hammer" label="Sessions" value={quantityFormat.format(seance.sessionCount)} />
        <StatTile icon="image" label="Captures" value={quantityFormat.format(seance.captureCount)} />
      </div>

      <h3 className="fm-subtitle">Achats</h3>
      <PurchasesTable items={seance.items} />

      <SeanceSessions seance={seance} onChanged={show} />

      <dialog ref={archiveDialog} className="outlier-confirm-dialog" aria-label="Archiver la séance de FM">
        <p><b>Archiver la séance de FM #{seance.name} ?</b></p>
        <p>
          {openSession && 'La session en cours sera arrêtée. '}
          Le salon sera archivé dans Discord, en lecture seule. Tu pourras rouvrir cette séance plus tard, avec tout son historique.
        </p>
        <div className="outlier-confirm-dialog-actions">
          <button type="button" onClick={() => archiveDialog.current?.close()}>Annuler</button>
          <button type="button" className="outlier-confirm-dialog-confirm" disabled={busy} onClick={() => void act(() => archiveFmSeance(seance.id))}>
            Archiver
          </button>
        </div>
      </dialog>
    </div>
  );
}
