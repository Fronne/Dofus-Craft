import { useState } from 'react';
import { AccountAvatar } from '../../app/AccountMenu';
import { useAuth } from '../../app/AuthContext';
import { EmptyState } from '../../components/EmptyState';
import { breedName } from '../../domain/breeds';
import { DeleteProfile } from '../forgemagie/ProfileTab';
import { BreedPicker } from './BreedPicker';

// specs/075-connexion-discord-site (US2, US3): the profile of the whole site — who the player is on Discord, the
// class icon they chose, whether they belong to the group's server, and the deletion of the profile.

export function ProfilPage() {
  const { status, me, loginUrl, updateMe, forget, retry } = useAuth();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  const chooseBreed = async (breedId: number | null) => {
    setSaving(true);
    setFailed(!(await updateMe({ breedId })));
    setSaving(false);
  };

  return (
    <>
      <header className="page-header">
        <h1>Mon profil</h1>
        <p>Ton identité sur le site : ton compte Discord et l'icône de ta classe.</p>
      </header>

      <section className="panel profile-panel">
        {status === 'loading' && <p className="empty" role="status">Connexion…</p>}

        {status === 'unavailable' && (
          <div className="fm-login">
            <EmptyState icon="info" title="Service indisponible" description="Le profil ne répond pas pour le moment. Le reste du site fonctionne normalement." />
            <button type="button" className="btn btn-secondary" onClick={retry}>Réessayer</button>
          </div>
        )}

        {status === 'anonymous' && (
          <div className="fm-login">
            <p>Connecte-toi avec ton compte Discord pour choisir l'icône de ta classe et retrouver ton profil sur tous tes appareils.</p>
            <a className="btn btn-primary" href={loginUrl('/profil')}>Se connecter avec Discord</a>
            <p className="fm-note">
              Aucun mot de passe : Discord confirme qui tu es. Seuls ton identifiant, ton pseudo et ton avatar Discord sont gardés.
            </p>
          </div>
        )}

        {status === 'connected' && me && (
          <>
            <div className="profile-identity">
              <AccountAvatar me={me} />
              <div>
                <p className="profile-name"><b>{me.displayName}</b></p>
                <p className="fm-note">Ton pseudo et ton avatar viennent de Discord.</p>
                <p className="fm-note">
                  {me.isMember
                    ? `Tu es membre du serveur Discord${me.guildName ? ` « ${me.guildName} »` : ' du groupe'} : la page Forgemagie t'est ouverte.`
                    : 'Tu n\'es pas membre du serveur Discord du groupe : la page Forgemagie lui est réservée.'}
                </p>
              </div>
            </div>

            <section className="fm-settings" aria-label="Icône de classe">
              <div className="fm-field">
                <span className="fm-field-label">Ma classe</span>
                <b>{me.breedId === null ? 'Aucune icône choisie' : breedName(me.breedId)}</b>
                <span className="fm-note">L'icône s'affiche à côté de ton pseudo en haut de la page.</span>
                <BreedPicker breedId={me.breedId} disabled={saving} onChange={(breedId) => void chooseBreed(breedId)} />
                {failed && <p className="fm-error" role="alert">L'icône n'a pas pu être enregistrée. Réessaie.</p>}
              </div>
            </section>

            <DeleteProfile onDeleted={forget} />
          </>
        )}
      </section>
    </>
  );
}
