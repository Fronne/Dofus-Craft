import { formatFmDate, type FmCapture } from '../../domain/forgemagie';
import { formatKamas } from '../../domain/kamas';
import { PlayerBadge } from './PlayerBadge';
import { ItemSummaryTable } from './SessionDetail';

// specs/031-fm-session-captures (US1): each capture read during the session, oldest first, with the
// recap of what it brought — so every amount of the session is traced back to its capture.

/** FR-005: beyond this many captures, they start folded. */
const UNFOLDED_MAX = 5;

const ORIGIN_LABELS: Record<FmCapture['origin'], string> = { bot: 'Discord', capture: 'Site' };

export function SessionCaptures({ captures }: { captures: FmCapture[] }) {
  const open = captures.length <= UNFOLDED_MAX;
  return (
    <section className="fm-captures" aria-label="Captures">
      <h3 className="fm-subtitle">Captures ({captures.length})</h3>
      {captures.length === 0 ? (
        <p className="empty">Aucune capture n'a encore été lue.</p>
      ) : (
        <ol className="fm-capture-list">
          {captures.map((capture, index) => (
            <li key={capture.id}>
              <details className="fm-capture" open={open}>
                <summary>
                  <span className="fm-capture-heading">
                    <b>Capture {index + 1}</b>
                    <span className="fm-note">{formatFmDate(capture.createdAt)} · {ORIGIN_LABELS[capture.origin]}</span>
                  </span>
                  <PlayerBadge player={capture.player} />
                  <span className="fm-amount">{formatKamas(capture.spentKamas)}</span>
                </summary>
                <ItemSummaryTable items={capture.items} showNote={false} />
              </details>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
