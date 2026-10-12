import { useEffect, useState, type FormEvent } from 'react';
import { INFO_MESSAGE_MAX_LENGTH, isInfoMessageActive, validateInfoMessageInput, type InfoMessage, type InfoTone } from '../src/domain/info-message';
import { Icon } from '../src/components/Icon';
import { adminApi } from './admin-api';
import { failureMessage } from './messages';

// specs/020-info-banner (contracts/info-banner-ui.md « Éditeur »): write, preview, publish or remove the
// one information message shown as a banner on the site. The end date is typed in the browser's own
// time — the owner's, in France, i.e. Paris time — and sent as ISO.

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Paris' });

// ISO → the `YYYY-MM-DDTHH:mm` a datetime-local field shows, in the browser's time.
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function MessageEditor() {
  const [current, setCurrent] = useState<InfoMessage | null>();
  const [text, setText] = useState('');
  const [tone, setTone] = useState<InfoTone>('info');
  const [endsAtLocal, setEndsAtLocal] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; error: boolean; field?: string }>();
  const [attempt, setAttempt] = useState(0);

  function load(message: InfoMessage | null) {
    setCurrent(message);
    setText(message?.text ?? '');
    setTone(message?.tone ?? 'info');
    setEndsAtLocal(toLocalInput(message?.endsAt ?? null));
  }

  useEffect(() => {
    let cancelled = false;
    void adminApi.getMessage().then((result) => {
      if (cancelled) return;
      if (result.status === 'ok') load(result.value);
      else setFeedback({ text: failureMessage(result), error: true });
    });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  async function publish(event: FormEvent) {
    event.preventDefault();
    const endsAt = endsAtLocal ? new Date(endsAtLocal).toISOString() : null;
    const validation = validateInfoMessageInput({ text, tone, endsAt });
    if (!validation.ok) {
      setFeedback({ text: validation.error, error: true, field: validation.field });
      return;
    }
    setBusy(true);
    const result = await adminApi.saveMessage(validation.value);
    setBusy(false);
    if (result.status === 'ok') {
      load(result.value);
      setFeedback({ text: 'Message publié.', error: false });
    } else {
      setFeedback({ text: failureMessage(result), error: true, field: result.status === 'invalid' ? result.field : undefined });
    }
  }

  async function remove() {
    setBusy(true);
    const result = await adminApi.deleteMessage();
    setBusy(false);
    if (result.status === 'ok') {
      load(null);
      setFeedback({ text: 'Message retiré.', error: false });
    } else {
      setFeedback({ text: failureMessage(result), error: true });
    }
  }

  const fieldError = (field: string) => feedback?.error && feedback.field === field
    ? <em role="alert">{feedback.text}</em>
    : null;

  return (
    <section className="panel admin-section" aria-labelledby="admin-message-title">
      <h2 id="admin-message-title">Bandeau d'information</h2>
      <p className="settings-section-description">
        Un message affiché en haut de toutes les pages du site. Visible par tous au prochain chargement ; chaque joueur peut le fermer.
      </p>
      {current === undefined && !feedback && <p className="empty" role="status">Chargement…</p>}
      {/* The message online could not be read: publishing now would replace it unseen. */}
      {current === undefined && feedback?.error && (
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
      {current && !isInfoMessageActive(current) && (
        <p className="admin-message admin-message--error">
          Expiré le {dateFormatter.format(new Date(current.endsAt as string))} : il n'est plus affiché.
        </p>
      )}
      <form className="admin-message-form" onSubmit={(event) => void publish(event)}>
        <label className="admin-message-field">
          Message
          <textarea
            aria-label="Message"
            aria-invalid={feedback?.error && feedback.field === 'text' ? true : undefined}
            value={text}
            maxLength={INFO_MESSAGE_MAX_LENGTH}
            rows={3}
            onChange={(event) => setText(event.target.value)}
          />
          <small>{text.trim().length} / {INFO_MESSAGE_MAX_LENGTH}</small>
          {fieldError('text')}
        </label>
        <fieldset className="admin-message-tones">
          <legend>Style</legend>
          <label className="admin-checkbox">
            <input type="radio" name="tone" checked={tone === 'info'} onChange={() => setTone('info')} /> Info
          </label>
          <label className="admin-checkbox">
            <input type="radio" name="tone" checked={tone === 'important'} onChange={() => setTone('important')} /> Important
          </label>
        </fieldset>
        <label className="admin-message-field">
          Fin (facultative)
          <input type="datetime-local" aria-label="Fin (facultative)" aria-invalid={feedback?.error && feedback.field === 'endsAt' ? true : undefined} value={endsAtLocal} onChange={(event) => setEndsAtLocal(event.target.value)} />
          {fieldError('endsAt')}
        </label>
        {text.trim() && (
          <div className="admin-message-preview">
            <span>Aperçu</span>
            <div className={`info-banner info-banner--${tone}`}>
              <Icon name="info" size={18} className="info-banner-icon" />
              <p className="info-banner-text">{text.trim()}</p>
            </div>
          </div>
        )}
        <div className="admin-counter-actions">
          <button type="submit" className="btn btn-primary" disabled={busy || current === undefined}>Publier</button>
          {current && (
            <button type="button" className="btn btn-secondary admin-danger" disabled={busy} onClick={() => void remove()}>Retirer</button>
          )}
        </div>
        {feedback && !feedback.field && (
          <p className={`admin-message${feedback.error ? ' admin-message--error' : ''}`} role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>
        )}
      </form>
    </section>
  );
}
