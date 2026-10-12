import { useEffect, useState } from 'react';
import type { SiteSettings } from '../src/domain/site-settings';
import { adminApi } from './admin-api';
import { failureMessage } from './messages';

// specs/050-forgemagie-page-toggle (contracts/site-settings-api.md « Interface »): turn a page of the
// site on or off. The state shown is always the one the server answered, never an assumed one (FR-008).
export function SiteSettingsEditor() {
  const [settings, setSettings] = useState<SiteSettings>();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; error: boolean }>();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void adminApi.getSettings().then((result) => {
      if (cancelled) return;
      if (result.status === 'ok') setSettings(result.value);
      else setFeedback({ text: failureMessage(result), error: true });
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  async function toggle(current: SiteSettings) {
    setBusy(true);
    const result = await adminApi.saveSettings({ forgemagiePage: !current.forgemagiePage });
    setBusy(false);
    if (result.status === 'ok') {
      setSettings(result.value);
      setFeedback({ text: result.value.forgemagiePage ? 'Page Forgemagie activée.' : 'Page Forgemagie désactivée.', error: false });
    } else {
      setFeedback({ text: failureMessage(result), error: true });
    }
  }

  return (
    <section className="panel admin-section" aria-labelledby="admin-pages-title">
      <h2 id="admin-pages-title">Pages du site</h2>
      <p className="settings-section-description">
        Une page désactivée disparaît de la navigation et son adresse affiche un message d'indisponibilité. Rien n'est supprimé. Visible par tous au prochain chargement.
      </p>
      {settings === undefined && !feedback && <p className="empty" role="status">Chargement…</p>}
      {settings === undefined && feedback?.error && (
        <div className="inline-retry">
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() => {
              setFeedback(undefined);
              setAttempt((count) => count + 1);
            }}
          >
            Réessayer
          </button>
        </div>
      )}
      {settings && (
        <div className="admin-page-toggle">
          <p>
            Page Forgemagie : <strong>{settings.forgemagiePage ? 'Activée' : 'Désactivée'}</strong>
          </p>
          <button type="button" className="btn btn-secondary btn-small" disabled={busy} onClick={() => void toggle(settings)}>
            {settings.forgemagiePage ? 'Désactiver' : 'Activer'}
          </button>
        </div>
      )}
      {feedback && (
        <p className={`admin-message${feedback.error ? ' admin-message--error' : ''}`} role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>
      )}
    </section>
  );
}
