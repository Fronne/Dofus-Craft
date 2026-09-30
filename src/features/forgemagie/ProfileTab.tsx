import { useEffect, useRef, useState } from 'react';
import { useActiveServer } from '../../app/ServerContext';
import { EmptyState } from '../../components/EmptyState';
import { formatFmDate, type FmMe, type FmPlayerSpend, type FmProfile } from '../../domain/forgemagie';
import { formatKamas } from '../../domain/kamas';
import type { PriceMode } from '../../domain/price-modes';
import { deleteFmMe, getFmPlayer, getFmPlayers } from '../../services/fm-api';
import { CaptureImport } from './CaptureImport';
import { FmItemsSection } from './FmItemsSection';
import { PlayerBadge } from './PlayerBadge';
import { ItemSummaryTable } from './SessionDetail';

// specs/025-rune-purchase-import: the player's settings (US1 — server, visibility), the spending of a
// player (US3 — theirs, or a public member's) and the deletion of the profile (FR-007).
// specs/026-hdv-rune-prices (FR-010, FR-011): the capture import, on the player's own profile only.

function ProfileSettings({ me, updateMe }: { me: FmMe; updateMe: (changes: { serverId?: string; isPrivate?: boolean }) => Promise<boolean> }) {
  const { servers } = useActiveServer();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const change = async (changes: { serverId?: string; isPrivate?: boolean }) => {
    setSaving(true);
    setFailed(!(await updateMe(changes)));
    setSaving(false);
  };

  return (
    <section className="fm-settings" aria-label="Réglages du profil">
      <label className="fm-field">
        <span className="fm-field-label">Serveur Dofus</span>
        <select
          className="hdv-type-filter"
          value={me.serverId ?? ''}
          disabled={saving}
          onChange={(event) => void change({ serverId: event.target.value })}
        >
          {me.serverId === null && <option value="">Choisir un serveur</option>}
          {servers.map((server) => <option key={server.id} value={server.id}>{server.name}</option>)}
        </select>
        <span className="fm-note">Tes achats envoyés par le bot sont rangés sur ce serveur.</span>
      </label>
      <div className="fm-field">
        <span className="fm-field-label">Visibilité</span>
        <div className="hdv-price-filters" role="group" aria-label="Visibilité du profil">
          {([false, true] as const).map((isPrivate) => (
            <button
              key={String(isPrivate)}
              type="button"
              aria-pressed={me.isPrivate === isPrivate}
              className={`hdv-price-filter${me.isPrivate === isPrivate ? ' hdv-price-filter--active' : ''}`}
              disabled={saving}
              onClick={() => void change({ isPrivate })}
            >
              {isPrivate ? 'Privé' : 'Public'}
            </button>
          ))}
        </div>
        <span className="fm-note">
          {me.isPrivate
            ? 'Ton profil n’est visible que par toi, et ton nom est masqué dans les sessions.'
            : 'Les membres du groupe voient ton profil et tes dépenses.'}
        </span>
      </div>
      {failed && <p className="fm-error" role="alert">Le réglage n'a pas pu être enregistré. Réessaie.</p>}
    </section>
  );
}

function DeleteProfile({ onDeleted }: { onDeleted: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, setState] = useState<'idle' | 'deleting' | 'failed'>('idle');

  const confirm = async () => {
    setState('deleting');
    const result = await deleteFmMe();
    if (result.status === 'ok' || result.status === 'unauthorized') {
      dialogRef.current?.close();
      onDeleted();
      return;
    }
    setState('failed');
  };

  return (
    <section className="fm-danger-zone">
      <button type="button" className="btn btn-secondary btn-small fm-delete" onClick={() => dialogRef.current?.showModal()}>
        Supprimer mon profil
      </button>
      <dialog ref={dialogRef} className="outlier-confirm-dialog" aria-label="Supprimer mon profil" onCancel={() => setState('idle')}>
        <p><b>Supprimer ton profil ?</b></p>
        <p>
          Ton profil, tes achats et ta ligne dans chaque session seront supprimés définitivement ; les totaux des sessions
          seront recalculés sans toi. Les prix déjà partagés avec le groupe restent, sans ton nom.
        </p>
        {state === 'failed' && <p className="fm-error" role="alert">La suppression a échoué. Réessaie.</p>}
        <div className="outlier-confirm-dialog-actions">
          <button type="button" onClick={() => { dialogRef.current?.close(); setState('idle'); }}>Annuler</button>
          <button type="button" className="outlier-confirm-dialog-confirm" disabled={state === 'deleting'} onClick={() => void confirm()}>
            Supprimer définitivement
          </button>
        </div>
      </dialog>
    </section>
  );
}

function Spending({ profile, onOpenSession }: { profile: FmProfile; onOpenSession: (sessionId: string) => void }) {
  return (
    <section className="fm-spending" aria-label="Dépenses de forgemagie">
      <p className="fm-total">Total dépensé : <strong>{formatKamas(profile.totalKamas)}</strong></p>
      {profile.sessions.length === 0 && profile.importedKamas === 0 ? (
        <EmptyState icon="anvil" title="Aucune dépense pour l'instant" />
      ) : (
        <>
          <h3 className="fm-subtitle">Par session</h3>
          <ul className="fm-spend-list">
            {profile.sessions.map((session) => (
              <li key={session.sessionId}>
                <button type="button" className="fm-link" onClick={() => onOpenSession(session.sessionId)}>
                  #{session.channelName} · {formatFmDate(session.openedAt)}
                </button>
                <span className="fm-amount">{formatKamas(session.spentKamas)}</span>
              </li>
            ))}
            {profile.importedKamas > 0 && (
              <li>
                <span>Captures importées sur le site</span>
                <span className="fm-amount">{formatKamas(profile.importedKamas)}</span>
              </li>
            )}
          </ul>
          <h3 className="fm-subtitle">Par objet</h3>
          <ItemSummaryTable items={profile.items} />
        </>
      )}
    </section>
  );
}

export function ProfileTab({ me, priceMode, updateMe, onDeleted, onOpenSession, onOpenItem, onUnauthorized }: {
  me: FmMe;
  priceMode: PriceMode;
  updateMe: (changes: { serverId?: string; isPrivate?: boolean }) => Promise<boolean>;
  onDeleted: () => void;
  onOpenSession: (sessionId: string) => void;
  onOpenItem: (itemId: string) => void;
  onUnauthorized: () => void;
}) {
  const [players, setPlayers] = useState<FmPlayerSpend[]>([]);
  const [shownId, setShownId] = useState(me.discordUserId);
  const [profile, setProfile] = useState<{ status: 'loading' | 'missing' | 'unavailable' } | { status: 'ready'; profile: FmProfile }>({ status: 'loading' });
  // Bumped after an import, to reread the spending it just added.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    void getFmPlayers().then((result) => {
      if (result.status === 'ok') setPlayers(result.data.players);
    });
  }, [me.isPrivate]);

  useEffect(() => {
    let cancelled = false;
    // An import rereads in place: the spending already shown stays until the new one arrives.
    if (version === 0) setProfile({ status: 'loading' });
    void getFmPlayer(shownId).then((result) => {
      if (cancelled) return;
      if (result.status === 'unauthorized') onUnauthorized();
      else if (result.status === 'ok') setProfile({ status: 'ready', profile: result.data });
      else setProfile({ status: result.status === 'not-found' ? 'missing' : 'unavailable' });
    });
    return () => {
      cancelled = true;
    };
  }, [shownId, me.isPrivate, onUnauthorized, version]);

  const isMine = shownId === me.discordUserId;
  const others = players.filter((player) => player.discordUserId && player.discordUserId !== me.discordUserId);

  return (
    <div className="fm-profile">
      {others.length > 0 && (
        <label className="fm-field fm-profile-picker">
          <span className="fm-field-label">Voir le profil de</span>
          <select className="hdv-type-filter" value={shownId} onChange={(event) => setShownId(event.target.value)}>
            <option value={me.discordUserId}>Moi</option>
            {others.map((player) => <option key={player.discordUserId} value={player.discordUserId!}>{player.displayName}</option>)}
          </select>
        </label>
      )}

      {isMine && <ProfileSettings me={me} updateMe={updateMe} />}
      {isMine && <CaptureImport me={me} priceMode={priceMode} onImported={() => setVersion((value) => value + 1)} />}
      {!isMine && profile.status === 'ready' && <h2 className="fm-section-title"><PlayerBadge player={profile.profile.player} /></h2>}

      {profile.status === 'loading' && <p className="empty" role="status">Chargement des dépenses…</p>}
      {profile.status === 'missing' && <EmptyState icon="info" title="Profil introuvable" description="Ce joueur a peut-être passé son profil en privé." />}
      {profile.status === 'unavailable' && <EmptyState icon="info" title="Dépenses indisponibles" description="Le service ne répond pas. Réessayez plus tard." />}
      {profile.status === 'ready' && (
        <FmItemsSection items={profile.profile.fmItems} isMine={isMine} onOpenItem={onOpenItem} onChanged={() => setVersion((value) => value + 1)} />
      )}
      {profile.status === 'ready' && <Spending profile={profile.profile} onOpenSession={onOpenSession} />}

      {isMine && <DeleteProfile onDeleted={onDeleted} />}
    </div>
  );
}
