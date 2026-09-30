import { useEffect, useState } from 'react';
import { fmItemDisplayName, type FmChannel, type FmMe, type FmOwnedItem, type FmSessionSync } from '../../domain/forgemagie';
import { getFmChannels, getFmPlayer, startFmSession } from '../../services/fm-api';

// specs/028-site-started-sessions (US1): start a session from the site, in a channel the bot has used,
// optionally attached to one of the player's items in FM. The bot opens it in Discord within seconds.

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

export function StartSession({ me, onStarted }: { me: FmMe; onStarted: (sessionId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [channels, setChannels] = useState<FmChannel[] | undefined>(undefined);
  const [items, setItems] = useState<FmOwnedItem[]>([]);
  const [channelId, setChannelId] = useState('');
  const [fmItemId, setFmItemId] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void Promise.all([getFmChannels(), getFmPlayer(me.discordUserId)]).then(([channelResult, profileResult]) => {
      if (cancelled) return;
      const list = channelResult.status === 'ok' ? channelResult.data.channels : [];
      setChannels(list);
      setChannelId(list.find((channel) => !channel.busy)?.channelId ?? '');
      if (profileResult.status === 'ok') setItems(profileResult.data.fmItems);
    });
    return () => {
      cancelled = true;
    };
  }, [open, me.discordUserId]);

  const start = async () => {
    setBusy(true);
    setError(undefined);
    const result = await startFmSession(channelId, fmItemId || null);
    setBusy(false);
    if (result.status === 'ok') {
      setOpen(false);
      onStarted(result.data.id);
      return;
    }
    setError(result.status === 'error' && result.code === 'channel-busy'
      ? 'Une session vient d’être ouverte dans ce salon. Choisis-en un autre.'
      : 'La session n’a pas pu être démarrée. Réessaie.');
  };

  if (!open) {
    return (
      <div className="fm-start">
        <button type="button" className="btn btn-primary btn-small" onClick={() => setOpen(true)}>Démarrer une session</button>
      </div>
    );
  }

  return (
    <div className="fm-start fm-add-item">
      {channels === undefined && <p className="fm-note" role="status">Chargement des salons…</p>}
      {channels && channels.length === 0 && (
        <p className="fm-note">Aucun salon connu : lance d’abord /fmstart une fois dans le salon voulu, sur Discord.</p>
      )}
      {channels && channels.length > 0 && (
        <>
          <label className="fm-field">
            <span className="fm-field-label">Salon Discord</span>
            <select className="hdv-type-filter" value={channelId} onChange={(event) => setChannelId(event.target.value)} aria-label="Salon Discord">
              {channels.map((channel) => (
                <option key={channel.channelId} value={channel.channelId} disabled={channel.busy}>
                  #{channel.channelName}{channel.busy ? ' (session en cours)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="fm-field">
            <span className="fm-field-label">Objet en FM (facultatif)</span>
            <select className="hdv-type-filter" value={fmItemId} onChange={(event) => setFmItemId(event.target.value)} aria-label="Objet en FM">
              <option value="">Aucun</option>
              {items.map((item) => <option key={item.id} value={item.id}>{fmItemDisplayName(item)}</option>)}
            </select>
          </label>
          <p className="fm-note">Le bot ouvrira aussi la session dans ce salon Discord, en quelques secondes.</p>
        </>
      )}
      {error && <p className="fm-error" role="alert">{error}</p>}
      <div className="fm-import-actions">
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)} disabled={busy}>Annuler</button>
        <button type="button" className="btn btn-primary" onClick={() => void start()} disabled={busy || !channelId}>Démarrer</button>
      </div>
    </div>
  );
}
