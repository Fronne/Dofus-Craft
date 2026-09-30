import { useEffect, useRef, useState } from 'react';
import { fmItemDisplayName, type FmChannel, type FmMe, type FmOwnedItem, type FmSessionSync } from '../../domain/forgemagie';
import { createFmChannel, getFmChannelRequest, getFmChannels, getFmPlayer, startFmSession } from '../../services/fm-api';

// specs/028-site-started-sessions (US1) and specs/029-channel-ownership (US3): start a session from the site —
// in a new personal channel the bot creates, or in one of the player's own active channels — optionally
// with one of their items in FM.

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

const MAX_NAME_LENGTH = 30;
const MAX_CHANNELS = 5;
const REQUEST_POLL_MS = 3000;
const REQUEST_TIMEOUT_MS = 2 * 60 * 1000;

export function StartSession({ me, onStarted }: { me: FmMe; onStarted: (sessionId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [channels, setChannels] = useState<FmChannel[] | undefined>(undefined);
  const [items, setItems] = useState<FmOwnedItem[]>([]);
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [name, setName] = useState('');
  const [channelId, setChannelId] = useState('');
  const [fmItemId, setFmItemId] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [waitingFor, setWaitingFor] = useState<{ requestId: string; since: number } | undefined>(undefined);
  const mounted = useRef(true);
  useEffect(() => () => {
    mounted.current = false;
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void Promise.all([getFmChannels(), getFmPlayer(me.discordUserId)]).then(([channelResult, profileResult]) => {
      if (cancelled) return;
      const list = channelResult.status === 'ok' ? channelResult.data.channels : [];
      setChannels(list);
      const free = list.find((channel) => !channel.busy);
      setChannelId(free?.channelId ?? '');
      setMode(free ? 'existing' : 'new');
      if (profileResult.status === 'ok') setItems(profileResult.data.fmItems);
    });
    return () => {
      cancelled = true;
    };
  }, [open, me.discordUserId]);

  // research R3: the channel doesn't exist yet — follow the request until the bot opened its session.
  useEffect(() => {
    if (!waitingFor) return;
    const timer = window.setTimeout(async () => {
      const result = await getFmChannelRequest(waitingFor.requestId);
      if (!mounted.current) return;
      if (result.status === 'ok' && result.data.status === 'failed') {
        setWaitingFor(undefined);
        setError(`Le bot n’a pas pu créer le salon${result.data.error ? ` : ${result.data.error}` : '.'}`);
      } else if (result.status === 'ok' && result.data.sessionId) {
        setWaitingFor(undefined);
        setOpen(false);
        onStarted(result.data.sessionId);
      } else if (Date.now() - waitingFor.since > REQUEST_TIMEOUT_MS) {
        setWaitingFor(undefined);
        setError('Le bot n’a pas encore créé le salon. Il le fera dès qu’il sera disponible : ton salon apparaîtra dans ton Profil.');
      } else {
        setWaitingFor({ ...waitingFor });
      }
    }, REQUEST_POLL_MS);
    return () => window.clearTimeout(timer);
  }, [waitingFor, onStarted]);

  const activeCount = channels?.length ?? 0;
  const freeChannels = (channels ?? []).filter((channel) => !channel.busy);

  const start = async () => {
    setBusy(true);
    setError(undefined);
    if (mode === 'new') {
      const result = await createFmChannel(name.trim(), fmItemId || null);
      setBusy(false);
      if (result.status === 'ok') {
        setWaitingFor({ requestId: result.data.requestId, since: Date.now() });
        return;
      }
      setError(result.status === 'error' && result.code === 'channel-limit'
        ? `Tu as déjà ${MAX_CHANNELS} salons FM actifs : archives-en un avec /fmarchive dans Discord.`
        : 'Le salon n’a pas pu être demandé. Réessaie.');
      return;
    }
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
        <button type="button" className="btn btn-primary btn-small" onClick={() => setOpen(true)}>Démarrer une séance</button>
      </div>
    );
  }

  if (waitingFor) {
    return (
      <div className="fm-start fm-add-item">
        <p className="fm-note" role="status">Création du salon dans Discord… (quelques secondes)</p>
      </div>
    );
  }

  return (
    <div className="fm-start fm-add-item">
      {channels === undefined && <p className="fm-note" role="status">Chargement de tes salons…</p>}
      {channels && (
        <>
          <div className="hdv-price-filters" role="group" aria-label="Salon de la séance">
            <button type="button" aria-pressed={mode === 'new'} className={`hdv-price-filter${mode === 'new' ? ' hdv-price-filter--active' : ''}`} onClick={() => setMode('new')}>
              Nouveau salon
            </button>
            <button
              type="button"
              aria-pressed={mode === 'existing'}
              className={`hdv-price-filter${mode === 'existing' ? ' hdv-price-filter--active' : ''}`}
              onClick={() => setMode('existing')}
              disabled={freeChannels.length === 0}
            >
              Un de mes salons
            </button>
          </div>
          {mode === 'new' ? (
            <label className="fm-field">
              <span className="fm-field-label">Nom du salon</span>
              <input value={name} maxLength={MAX_NAME_LENGTH} onChange={(event) => setName(event.target.value)} placeholder="Par exemple « mon rtograf »" aria-label="Nom du salon" />
              <span className="fm-note">Le bot crée un salon privé, visible par toi seul. {activeCount}/{MAX_CHANNELS} salons actifs.</span>
            </label>
          ) : (
            <label className="fm-field">
              <span className="fm-field-label">Salon</span>
              <select className="hdv-type-filter" value={channelId} onChange={(event) => setChannelId(event.target.value)} aria-label="Mon salon">
                {(channels ?? []).map((channel) => (
                  <option key={channel.channelId} value={channel.channelId} disabled={channel.busy}>
                    #{channel.channelName}{channel.busy ? ' (session en cours)' : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="fm-field">
            <span className="fm-field-label">Objet en FM (facultatif)</span>
            <select className="hdv-type-filter" value={fmItemId} onChange={(event) => setFmItemId(event.target.value)} aria-label="Objet en FM">
              <option value="">Aucun</option>
              {items.map((item) => <option key={item.id} value={item.id}>{fmItemDisplayName(item)}</option>)}
            </select>
            {mode === 'new' && <span className="fm-note">L’objet sera rattaché au salon : toutes ses sessions compteront pour lui.</span>}
          </label>
        </>
      )}
      {error && <p className="fm-error" role="alert">{error}</p>}
      <div className="fm-import-actions">
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)} disabled={busy}>Annuler</button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void start()}
          disabled={busy || !channels || (mode === 'new' ? !name.trim() : !channelId)}
        >
          Démarrer
        </button>
      </div>
    </div>
  );
}
