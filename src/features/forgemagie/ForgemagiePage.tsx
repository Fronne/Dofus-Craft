import { useState } from 'react';
import { EmptyState } from '../../components/EmptyState';
import { Icon, type IconName } from '../../components/Icon';
import { groupTabLabel } from '../../domain/forgemagie';
import type { PriceMode } from '../../domain/price-modes';
import { fmLoginUrl } from '../../services/fm-api';
import { PlayerBadge } from './PlayerBadge';
import { PlayersTab } from './PlayersTab';
import { ProfileTab } from './ProfileTab';
import { SeanceDetail } from './SeanceDetail';
import { SeancesTab } from './SeancesTab';
import { useFmAuth } from './useFmAuth';

// specs/025-rune-purchase-import: the Forgemagie page, for members of the group's Discord server only
// (FR-001, FR-002). The rest of the site stays anonymous (FR-003).
// specs/049-fm-seances: the page is about séances de FM — one's own, then what forgemagie cost the
// players of the group, then one's profile.

type FmTab = 'seances' | 'players' | 'profile';

const TABS: { id: FmTab; icon: IconName }[] = [
  { id: 'seances', icon: 'hammer' },
  { id: 'players', icon: 'users' },
  { id: 'profile', icon: 'user' },
];

const LOGIN_ERRORS = {
  'not-member': 'La page Forgemagie est réservée aux membres du serveur Discord du groupe.',
  'login-failed': 'La connexion a échoué, réessaie.',
};

export function ForgemagiePage({ priceMode }: { priceMode: PriceMode }) {
  const auth = useFmAuth();
  const [tab, setTab] = useState<FmTab>('seances');
  const [openSeanceId, setOpenSeanceId] = useState<string | undefined>(undefined);

  const openSeance = (seanceId: string) => {
    setOpenSeanceId(seanceId);
    setTab('seances');
  };

  return (
    <>
      <header className="page-header">
        <h1>Forgemagie</h1>
        <p>Tes séances de FM, leurs sessions et ce qu'elles ont coûté.</p>
      </header>

      <section className="panel hdv-panel fm-panel">
        {auth.status === 'loading' && <p className="empty" role="status">Connexion…</p>}

        {auth.status === 'unavailable' && (
          <div className="fm-login">
            <EmptyState icon="info" title="Service indisponible" description="La page Forgemagie ne répond pas pour le moment. Le reste du site fonctionne normalement." />
            <button type="button" className="btn btn-secondary" onClick={auth.retry}>Réessayer</button>
          </div>
        )}

        {auth.status === 'anonymous' && (
          <div className="fm-login">
            <p>
              Connecte-toi avec ton compte Discord pour retrouver tes séances de FM et ce qu'elles ont coûté. Le prix des
              runes est dans la page HDV, onglet Runes.
            </p>
            {auth.loginError && <p className="fm-error" role="alert">{LOGIN_ERRORS[auth.loginError]}</p>}
            <a className="btn btn-primary" href={fmLoginUrl()}>Se connecter avec Discord</a>
            <p className="fm-note">
              Seuls ton identifiant, ton pseudo et ton avatar Discord sont gardés. Discord te demandera aussi l'accès à la
              liste de tes serveurs : seul le nom de celui du groupe y est lu.
            </p>
          </div>
        )}

        {auth.status === 'connected' && auth.me && (
          <>
            <div className="fm-account">
              <PlayerBadge player={{ discordUserId: auth.me.discordUserId, displayName: auth.me.displayName, avatarUrl: auth.me.avatarUrl, private: auth.me.isPrivate }} />
              <button type="button" className="btn btn-secondary btn-small" onClick={() => void auth.logout()}>Se déconnecter</button>
            </div>

            <div className="hdv-tabs" role="tablist" aria-label="Forgemagie">
              {TABS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  role="tab"
                  aria-selected={entry.id === tab}
                  className={`hdv-tab hdv-tab--icon fm-tab${entry.id === 'players' ? ' fm-tab--group' : ''}${entry.id === tab ? ' hdv-tab--active' : ''}`}
                  onClick={() => {
                    setTab(entry.id);
                    if (entry.id === 'seances') setOpenSeanceId(undefined);
                  }}
                >
                  <Icon name={entry.icon} size={18} />
                  <span className="fm-tab-label">
                    {entry.id === 'seances' ? 'Séances de FM' : entry.id === 'players' ? groupTabLabel(auth.me!) : 'Profil'}
                  </span>
                </button>
              ))}
            </div>

            {tab === 'seances' && (openSeanceId
              ? <SeanceDetail key={openSeanceId} seanceId={openSeanceId} me={auth.me} priceMode={priceMode} onBack={() => setOpenSeanceId(undefined)} onUnauthorized={auth.forget} />
              : <SeancesTab me={auth.me} onOpen={setOpenSeanceId} onUnauthorized={auth.forget} />)}
            {tab === 'players' && <PlayersTab onUnauthorized={auth.forget} />}
            {tab === 'profile' && <ProfileTab me={auth.me} updateMe={auth.updateMe} onDeleted={auth.forget} onOpenSeance={openSeance} onUnauthorized={auth.forget} />}
          </>
        )}
      </section>
    </>
  );
}
