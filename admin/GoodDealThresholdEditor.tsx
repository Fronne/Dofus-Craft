import { useEffect, useState } from 'react';
import { MAX_THRESHOLD, MIN_THRESHOLD } from '../src/domain/good-deals';
import { adminApi } from './admin-api';
import { failureMessage } from './messages';

// specs/078-bons-plans-hdv: the percentage from which an HDV announcement is a good deal (25 by default).
// The value shown is the one the server answered, never an assumed one.
export function GoodDealThresholdEditor() {
  const [saved, setSaved] = useState<number>();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; error: boolean }>();

  useEffect(() => {
    let cancelled = false;
    void adminApi.getGoodDealThreshold().then((result) => {
      if (cancelled) return;
      if (result.status === 'ok') {
        setSaved(result.value);
        setDraft(String(result.value));
      } else {
        setFeedback({ text: failureMessage(result), error: true });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setBusy(true);
    const result = await adminApi.saveGoodDealThreshold(Number(draft));
    setBusy(false);
    if (result.status === 'ok') {
      setSaved(result.value);
      setDraft(String(result.value));
      setFeedback({ text: `Seuil enregistré : ${result.value} %.`, error: false });
    } else {
      setFeedback({ text: failureMessage(result), error: true });
    }
  }

  const valid = /^\d+$/.test(draft) && Number(draft) >= MIN_THRESHOLD && Number(draft) <= MAX_THRESHOLD;

  return (
    <section className="panel admin-section" aria-labelledby="admin-threshold-title">
      <h2 id="admin-threshold-title">Seuil des bons plans</h2>
      <p className="settings-section-description">
        Une annonce de l'HDV est un bon plan quand elle coûte au moins ce pourcentage de moins que des annonces de jet proche
        ({MIN_THRESHOLD} à {MAX_THRESHOLD} %, 25 % par défaut). Visible par tous au prochain chargement de la page.
      </p>
      {saved === undefined && !feedback && <p className="empty" role="status">Chargement…</p>}
      {saved !== undefined && (
        <div className="admin-page-toggle">
          <label>
            Seuil (%){' '}
            <input type="number" inputMode="numeric" min={MIN_THRESHOLD} max={MAX_THRESHOLD} step={1} value={draft} onChange={(event) => setDraft(event.target.value)} />
          </label>
          <button type="button" className="btn btn-secondary btn-small" disabled={busy || !valid || Number(draft) === saved} onClick={() => void save()}>
            Enregistrer
          </button>
        </div>
      )}
      {feedback && <p className={feedback.error ? 'admin-message admin-message--error' : 'admin-message'} role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
    </section>
  );
}
