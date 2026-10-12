import { useEffect, useRef, useState } from 'react';
import { useActiveServer } from '../../app/ServerContext';
import { EmptyState } from '../../components/EmptyState';
import { formatFmDate, groupTabLabel, spendingBySeance, type FmMe, type FmProfile } from '../../domain/forgemagie';
import { deleteFmMe, getFmPlayer } from '../../services/fm-api';
import { Kamas } from '../prices/PricesPage';
import { PurchasesTable } from './PurchasesTable';

// specs/025-rune-purchase-import: the player's settings (visibility), their spending and the deletion of
// the profile. specs/049-fm-seances (US5): the server is the site's own, and the spending is told by
// séance de FM.

function ProfileSettings({ me, updateMe }: { me: FmMe; updateMe: (changes: { isPrivate?: boolean }) => Promise<boolean> }) {
  const { servers } = useActiveServer();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const server = servers.find((entry) => entry.id === me.serverId);

  const change = async (changes: { isPrivate?: boolean }) => {
    setSaving(true);
    setFailed(!(await updateMe(changes)));
    setSaving(false);
  };

  return (
    <section className="fm-settings" aria-label="Réglages du profil">
      <div className="fm-field">
        <span className="fm-field-label">Serveur Dofus</span>
        <b>{server?.name ?? '—'}</b>
        <span className="fm-note">Tes achats sont rangés sur ce serveur : celui que tu as choisi pour tout le site, en haut de la page.</span>
      </div>
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
          Public : les autres membres voient, dans l’onglet {groupTabLabel(me)}, ton pseudo, ton total dépensé et la liste de tes
          séances de FM (nom, objet, état, total). Privé : tu n’y apparais pas. Dans les deux cas, personne d’autre ne voit tes
          sessions, tes captures ni tes runes achetées.
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
      <button type="button" className="btn btn-danger btn-small" onClick={() => dialogRef.current?.showModal()}>
        Supprimer mon profil
      </button>
      <dialog ref={dialogRef} className="outlier-confirm-dialog" aria-label="Supprimer mon profil" onCancel={() => setState('idle')}>
        <p><b>Supprimer ton profil ?</b></p>
        <p>
          Ton profil et tes achats seront supprimés définitivement ; tes séances de FM ne seront plus visibles. Les prix déjà
          partagés avec le groupe restent, sans ton nom.
        </p>
        {state === 'failed' && <p className="fm-error" role="alert">La suppression a échoué. Réessaie.</p>}
        <div className="outlier-confirm-dialog-actions">
          <button type="button" onClick={() => { dialogRef.current?.close(); setState('idle'); }}>Annuler</button>
          <button type="button" className="outlier-confirm-dialog-confirm" disabled={state === 'deleting'} onClick={() => void confirm()}>
            {state === 'deleting' ? 'Suppression…' : 'Supprimer définitivement'}
          </button>
        </div>
      </dialog>
    </section>
  );
}

function Spending({ profile, onOpenSeance }: { profile: FmProfile; onOpenSeance: (seanceId: string) => void }) {
  const seances = spendingBySeance(profile.sessions);
  return (
    <section className="fm-spending" aria-label="Dépenses de forgemagie">
      <p className="fm-total">Total dépensé : <strong><Kamas value={profile.totalKamas} /></strong></p>
      {seances.length === 0 && profile.importedKamas === 0 ? (
        <EmptyState icon="hammer" title="Aucune dépense pour l'instant" />
      ) : (
        <>
          <h3 className="fm-subtitle">Par séance de FM</h3>
          <ul className="fm-spend-list">
            {seances.map((seance) => {
              const text = `#${seance.name} · ${formatFmDate(seance.lastOpenedAt)}`;
              return (
                <li key={seance.key}>
                  {seance.seanceId !== undefined
                    ? <button type="button" className="fm-link" onClick={() => onOpenSeance(seance.seanceId!)}>{text}</button>
                    : <span>{text}</span>}
                  <span className="fm-amount"><Kamas value={seance.spentKamas} /></span>
                </li>
              );
            })}
            {profile.importedKamas > 0 && (
              <li>
                <span>Captures importées hors séance</span>
                <span className="fm-amount"><Kamas value={profile.importedKamas} /></span>
              </li>
            )}
          </ul>
          <h3 className="fm-subtitle">Par objet acheté</h3>
          <PurchasesTable items={profile.items} />
        </>
      )}
    </section>
  );
}

export function ProfileTab({ me, updateMe, onDeleted, onOpenSeance, onUnauthorized }: {
  me: FmMe;
  updateMe: (changes: { isPrivate?: boolean }) => Promise<boolean>;
  onDeleted: () => void;
  onOpenSeance: (seanceId: string) => void;
  onUnauthorized: () => void;
}) {
  const [profile, setProfile] = useState<{ status: 'loading' | 'missing' | 'unavailable' } | { status: 'ready'; profile: FmProfile }>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void getFmPlayer(me.discordUserId).then((result) => {
      if (cancelled) return;
      if (result.status === 'unauthorized') onUnauthorized();
      else if (result.status === 'ok') setProfile({ status: 'ready', profile: result.data });
      else setProfile({ status: result.status === 'not-found' ? 'missing' : 'unavailable' });
    });
    return () => {
      cancelled = true;
    };
  }, [me.discordUserId, onUnauthorized, attempt]);

  return (
    <div className="fm-profile">
      <ProfileSettings me={me} updateMe={updateMe} />

      {profile.status === 'loading' && <p className="empty" role="status">Chargement des dépenses…</p>}
      {profile.status === 'missing' && <EmptyState icon="info" title="Profil introuvable" description="Reconnecte-toi avec Discord, puis réessaie." />}
      {profile.status === 'unavailable' && (
        <div role="alert">
          <EmptyState icon="info" title="Dépenses indisponibles" description="Le service ne répond pas pour le moment.">
            <button type="button" className="btn btn-primary" onClick={() => { setProfile({ status: 'loading' }); setAttempt((count) => count + 1); }}>Réessayer</button>
          </EmptyState>
        </div>
      )}
      {profile.status === 'ready' && <Spending profile={profile.profile} onOpenSeance={onOpenSeance} />}

      <DeleteProfile onDeleted={onDeleted} />
    </div>
  );
}
