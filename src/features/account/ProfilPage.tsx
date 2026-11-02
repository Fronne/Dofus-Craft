import { AccountAvatar } from '../../app/AccountMenu';
import { useAuth } from '../../app/AuthContext';
import { EmptyState } from '../../components/EmptyState';
import { DeleteProfile } from '../forgemagie/ProfileTab';

// specs/075-connexion-discord-site (US2): the profile of the whole site — who the player is on Discord, whether
// they belong to the group's server, and the deletion of the profile.

export function ProfilPage() {
  const { status, me, loginUrl, forget, retry } = useAuth();

  return (
    <>
      <header className="page-header">
        <h1>Mon profil</h1>
        <p>Ton identité sur le site : ton compte Discord.</p>
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
            <p>Connecte-toi avec ton compte Discord pour retrouver ton profil sur tous tes appareils.</p>
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

            <DeleteProfile onDeleted={forget} />
          </>
        )}
      </section>
    </>
  );
}
