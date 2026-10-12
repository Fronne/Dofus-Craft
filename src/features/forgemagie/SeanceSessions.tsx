import { useState } from 'react';
import { Icon } from '../../components/Icon';
import {
  formatFmDate, mergeIgnoredLines, type FmSeanceCapture, type FmSeanceDetail, type FmSeanceSession, type FmSessionSync,
} from '../../domain/forgemagie';
import { formatKamas } from '../../domain/kamas';
import { Kamas } from '../prices/PricesPage';
import { CaptureCorrection } from './CaptureCorrection';
import { PurchasesTable } from './PurchasesTable';

// specs/049-fm-seances (US1, US3): the sessions of a séance, each one folded, with its captures — what
// each capture bought, the lines that do not count, and its correction.

const quantityFormat = new Intl.NumberFormat('fr-FR');

export function SyncBadge({ sync }: { sync: FmSessionSync }) {
  const text = {
    pending: 'En attente de Discord…',
    opened: 'Ouverte dans Discord',
    stale: 'Non transmise à Discord',
    failed: `Échec dans Discord${sync.error ? ` : ${sync.error}` : ''}`,
    cancelled: 'Jamais ouverte dans Discord',
  }[sync.status];
  return <span className={`fm-sync fm-sync--${sync.status}`}>{text}</span>;
}

const FoldChevron = ({ className = '' }: { className?: string }) => (
  <span className={`fm-fold-chevron${className ? ` ${className}` : ''}`} aria-hidden="true"><Icon name="chevron-down" size={16} /></span>
);
export { FoldChevron };

function Capture({ capture, number, outlier, onChanged }: {
  capture: FmSeanceCapture;
  number: number;
  /** The last correction of this capture gave a price too far from the group's to be shared. */
  outlier: boolean;
  onChanged: (seance: FmSeanceDetail, outlierCaptureId: string | undefined) => void;
}) {
  const [correcting, setCorrecting] = useState(false);
  const ignored = mergeIgnoredLines(capture.ignored);
  const fromBot = capture.origin === 'bot';

  return (
    <details className="fm-capture">
      <summary>
        <span className="fm-capture-heading">
          <b>Capture {number}</b>
          <span className="fm-note">{formatFmDate(capture.createdAt)} · {fromBot ? 'Discord' : 'Site'}</span>
          {capture.corrected && <span className="fm-corrected">corrigée</span>}
        </span>
        <span className="fm-amount"><Kamas value={capture.spentKamas} /></span>
        <FoldChevron />
      </summary>
      {correcting ? (
        <CaptureCorrection
          capture={capture}
          onCancel={() => setCorrecting(false)}
          onSaved={(seance, isOutlier) => {
            setCorrecting(false);
            onChanged(seance, isOutlier ? capture.id : undefined);
          }}
        />
      ) : (
        <>
          <PurchasesTable items={capture.items} showTotal={false} />
          {ignored.length > 0 && (
            <p className="fm-note">
              Non compté (pas une rune) :{' '}
              {ignored.map((line) => `${line.quantity > 1 ? `${quantityFormat.format(line.quantity)} × ` : ''}${line.itemName} (${formatKamas(line.totalKamas)})`).join(', ')}.
              {fromBot && ' Le bot, dans Discord, les compte dans son total.'}
            </p>
          )}
          {outlier && <p className="fm-note" role="status">Dépense corrigée. Le prix n’est pas partagé avec le groupe : il est trop éloigné des relevés.</p>}
          {capture.corrected && fromBot && <p className="fm-note">Le récap du bot dans Discord garde le montant lu.</p>}
          {capture.lines.length > 0 && (
            <button type="button" className="btn btn-secondary btn-small fm-correct" onClick={() => setCorrecting(true)}>Corriger</button>
          )}
        </>
      )}
    </details>
  );
}

function Session({ session, outlierCaptureId, onChanged }: {
  session: FmSeanceSession;
  outlierCaptureId: string | undefined;
  onChanged: (seance: FmSeanceDetail, outlierCaptureId: string | undefined) => void;
}) {
  const open = session.status === 'open';
  const count = session.captures.length;
  const state = open ? 'en cours' : session.closedAt ? `arrêtée le ${formatFmDate(session.closedAt)}` : 'arrêtée';

  return (
    <details className={`fm-capture fm-session-fold${open ? ' fm-session-fold--open' : ''}`}>
      <summary>
        <span className="fm-capture-heading">
          <b>Session du {formatFmDate(session.openedAt)}</b>
          <span className="fm-note">{state} · {count} {count > 1 ? 'captures' : 'capture'}</span>
        </span>
        {open && session.sync && <SyncBadge sync={session.sync} />}
        <span className="fm-amount"><Kamas value={session.totalKamas} /></span>
        <FoldChevron />
      </summary>
      {count === 0 ? (
        <p className="fm-note">Aucune capture n'a été lue pendant cette session.</p>
      ) : (
        <ol className="fm-capture-list">
          {session.captures.map((capture, index) => (
            <li key={capture.id}>
              <Capture capture={capture} number={index + 1} outlier={capture.id === outlierCaptureId} onChanged={onChanged} />
            </li>
          ))}
        </ol>
      )}
    </details>
  );
}

export function SeanceSessions({ seance, onChanged }: { seance: FmSeanceDetail; onChanged: (seance: FmSeanceDetail) => void }) {
  const [outlierCaptureId, setOutlierCaptureId] = useState<string | undefined>(undefined);
  const changed = (next: FmSeanceDetail, outlier: string | undefined) => {
    setOutlierCaptureId(outlier);
    onChanged(next);
  };

  return (
    <section className="fm-captures" aria-label="Sessions">
      <h3 className="fm-subtitle">Sessions ({seance.sessions.length})</h3>
      {seance.sessions.length === 0 ? (
        <p className="fm-note">Aucune session pour l'instant.</p>
      ) : (
        <ul className="fm-capture-list">
          {seance.sessions.map((session) => (
            <li key={session.id}><Session session={session} outlierCaptureId={outlierCaptureId} onChanged={changed} /></li>
          ))}
        </ul>
      )}
    </section>
  );
}
