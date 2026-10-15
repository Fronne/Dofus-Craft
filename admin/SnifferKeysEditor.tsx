import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { adminApi, type AdminResult, type SnifferKeyJson } from './admin-api';
import { failureMessage } from './messages';

// specs/057-sniffer-admin (contracts/admin-sniffer-api.md « Interface »): one key per friend for the HDV
// price tool. The key itself is shown once, right after its creation, and can never be read again.

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Paris' });
const formatDate = (iso: string) => dateFormatter.format(new Date(iso));

const keyFailure = (result: Exclude<AdminResult<unknown>, { status: 'ok' }>) =>
  (result.status === 'not-found' ? "Cette clé n'existe plus : rechargez la page." : failureMessage(result));

export function SnifferKeysEditor() {
  const [keys, setKeys] = useState<SnifferKeyJson[]>();
  const [label, setLabel] = useState('');
  const [created, setCreated] = useState<{ label: string; secret: string }>();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; error: boolean }>();

  const reload = useCallback(async () => {
    const result = await adminApi.listSnifferKeys();
    if (result.status === 'ok') setKeys(result.value);
    else setFeedback({ text: failureMessage(result), error: true });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void adminApi.listSnifferKeys().then((result) => {
      if (cancelled) return;
      if (result.status === 'ok') setKeys(result.value);
      else setFeedback({ text: failureMessage(result), error: true });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const result = await adminApi.createSnifferKey(label);
    setBusy(false);
    if (result.status === 'ok') {
      setCreated({ label: result.value.key.label, secret: result.value.secret });
      setCopied(false);
      setLabel('');
      setFeedback(undefined);
      void reload();
    } else {
      setFeedback({ text: keyFailure(result), error: true });
    }
  }

  async function copy(secret: string) {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      setFeedback({ text: 'Copie impossible : sélectionnez la clé et copiez-la à la main.', error: true });
    }
  }

  async function revoke(key: SnifferKeyJson) {
    if (!window.confirm(`Révoquer la clé de ${key.label} ? Son outil ne pourra plus envoyer de prix.`)) return;
    setBusy(true);
    const result = await adminApi.revokeSnifferKey(key.id);
    setBusy(false);
    if (result.status === 'ok') {
      setFeedback({ text: `Clé de ${key.label} révoquée.`, error: false });
      void reload();
    } else {
      setFeedback({ text: keyFailure(result), error: true });
    }
  }

  return (
    <section className="panel admin-section" aria-labelledby="admin-sniffer-keys-title">
      <h2 id="admin-sniffer-keys-title">Clés sniffer</h2>
      <p className="settings-section-description">
        Une clé par ami pour l'outil qui envoie les prix de l'HDV. Seule son empreinte est gardée : la clé n'est affichée qu'à sa création.
      </p>

      <form className="admin-sniffer-form" onSubmit={(event) => void create(event)}>
        <label>
          Nom de l'ami
          <input value={label} maxLength={60} onChange={(event) => setLabel(event.target.value)} required />
        </label>
        <button type="submit" className="btn btn-primary" disabled={busy}>Créer une clé</button>
      </form>

      {created && (
        <div className="admin-sniffer-secret" role="status">
          <p>Clé de <strong>{created.label}</strong> :</p>
          <code>{created.secret}</code>
          <p className="admin-sniffer-warning">Cette clé ne sera plus affichée : transmettez-la maintenant.</p>
          <div className="admin-counter-actions">
            <button type="button" className="btn btn-secondary btn-small" onClick={() => void copy(created.secret)}>
              {copied ? 'Copiée' : 'Copier'}
            </button>
            <button type="button" className="btn btn-secondary btn-small" onClick={() => setCreated(undefined)}>J'ai copié la clé</button>
          </div>
        </div>
      )}

      {feedback && (
        <p className={`admin-message${feedback.error ? ' admin-message--error' : ''}`} role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>
      )}
      {keys === undefined && !feedback && <p className="empty" role="status">Chargement…</p>}
      {keys?.length === 0 && <p className="empty">Aucune clé pour l'instant.</p>}
      {keys && keys.length > 0 && (
        <ul className="admin-sniffer-list">
          {keys.map((key) => (
            <li key={key.id} className={key.revokedAt ? 'admin-sniffer-row admin-sniffer-row--off' : 'admin-sniffer-row'}>
              <div>
                <p className="admin-counter-player">{key.label}</p>
                <p className="admin-counter-meta">
                  Créée le {formatDate(key.createdAt)} · dernier envoi : {key.lastSeenAt ? formatDate(key.lastSeenAt) : 'jamais'}
                </p>
                <p className="admin-counter-meta">
                  Prix enregistrés aujourd'hui (UTC) : <strong>{key.rowsToday}</strong>
                  {' · '}
                  {key.revokedAt ? `révoquée le ${formatDate(key.revokedAt)}` : 'active'}
                </p>
              </div>
              {!key.revokedAt && (
                <button type="button" className="btn btn-secondary btn-small admin-danger" disabled={busy} onClick={() => void revoke(key)}>
                  Révoquer
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
