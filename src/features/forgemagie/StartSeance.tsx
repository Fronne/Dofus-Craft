import { useEffect, useRef, useState } from 'react';
import type { FmMe, FmOwnedItem } from '../../domain/forgemagie';
import { createFmSeance, getFmChannelRequest, getFmPlayer } from '../../services/fm-api';
import { FmItemIcon } from './FmItemIcon';
import { SeanceItemSearch, type PickedItem } from './SeanceItemSearch';

// specs/049-fm-seances (US2): create a séance de FM from the site — the bot creates a private Discord
// channel with that name and opens a first session in it — optionally with the item being forgemaged.

const MAX_NAME_LENGTH = 30;
const REQUEST_POLL_MS = 3000;
const REQUEST_TIMEOUT_MS = 2 * 60 * 1000;

export function StartSeance({ me, onCreated }: { me: FmMe; onCreated: (seanceId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<FmOwnedItem[]>([]);
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<PickedItem | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [waitingFor, setWaitingFor] = useState<{ requestId: string; since: number } | undefined>(undefined);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void getFmPlayer(me.discordUserId).then((result) => {
      if (!cancelled && result.status === 'ok') setItems(result.data.fmItems);
    });
    return () => {
      cancelled = true;
    };
  }, [open, me.discordUserId]);

  // The channel does not exist yet: follow the request until the bot created it.
  useEffect(() => {
    if (!waitingFor) return;
    const timer = window.setTimeout(async () => {
      const result = await getFmChannelRequest(waitingFor.requestId);
      if (!mounted.current) return;
      const request = result.status === 'ok' ? result.data : undefined;
      if (request?.status === 'failed') {
        setWaitingFor(undefined);
        setError(`Le bot n’a pas pu créer le salon${request.error ? ` : ${request.error}` : '.'}`);
      } else if (request?.channelId && (request.sessionId || request.status === 'done')) {
        setWaitingFor(undefined);
        setOpen(false);
        setName('');
        setPicked(undefined);
        onCreated(request.channelId);
      } else if (Date.now() - waitingFor.since > REQUEST_TIMEOUT_MS) {
        setWaitingFor(undefined);
        setError("Le bot n’a pas encore créé le salon. Il le fera dès qu’il sera disponible : ta séance de FM apparaîtra dans la liste.");
      } else {
        setWaitingFor({ ...waitingFor });
      }
    }, REQUEST_POLL_MS);
    return () => window.clearTimeout(timer);
  }, [waitingFor, onCreated]);

  const create = async () => {
    setBusy(true);
    setError(undefined);
    const result = await createFmSeance(name.trim(), picked?.target);
    setBusy(false);
    if (result.status === 'ok') {
      setWaitingFor({ requestId: result.data.requestId, since: Date.now() });
      return;
    }
    setError(result.status === 'error' && result.code === 'channel-limit'
      ? 'Tu as déjà 5 séances de FM non archivées : archives-en une avant d’en créer une autre.'
      : 'La séance de FM n’a pas pu être créée. Réessaie.');
  };

  if (!open) {
    return (
      <div className="fm-start">
        <button type="button" className="btn btn-primary btn-small" onClick={() => setOpen(true)}>Nouvelle séance de FM</button>
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
      <label className="fm-field">
        <span className="fm-field-label">Nom de la séance</span>
        <input
          value={name}
          maxLength={MAX_NAME_LENGTH}
          onChange={(event) => setName(event.target.value)}
          placeholder="Par exemple « mon rtograf »"
          aria-label="Nom de la séance"
        />
        <span className="fm-note">Le bot crée un salon Discord privé à ce nom, visible par toi seul, et y ouvre une première session.</span>
      </label>
      <div className="fm-field fm-start-item">
        <span className="fm-field-label">Objet en FM (facultatif)</span>
        {picked ? (
          <p className="fm-picked">
            <FmItemIcon imageUrl={picked.imageUrl} /> <b>{picked.name}</b>
            <button type="button" className="btn btn-secondary btn-small" onClick={() => setPicked(undefined)}>Retirer</button>
          </p>
        ) : (
          <SeanceItemSearch label="Chercher un objet" myItems={items} disabled={busy} onPick={setPicked} />
        )}
        <span className="fm-note">Tu pourras le choisir ou le changer plus tard, depuis la séance.</span>
      </div>
      {error && <p className="fm-error" role="alert">{error}</p>}
      <div className="fm-import-actions">
        <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)} disabled={busy}>Annuler</button>
        <button type="button" className="btn btn-primary" onClick={() => void create()} disabled={busy || !name.trim()}>
          Créer la séance
        </button>
      </div>
    </div>
  );
}
