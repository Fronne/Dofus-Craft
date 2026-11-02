import { useState } from 'react';
import { tabOnKey } from '../../components/tab-keys';
import { EmptyState } from '../../components/EmptyState';
import { Icon, type IconName } from '../../components/Icon';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../app/router';
import { groupTabLabel } from '../../domain/forgemagie';
import type { PriceMode } from '../../domain/price-modes';
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
// specs/075-connexion-discord-site: anyone can log in on the site; this page is what asks for the membership, and
// tells a logged-in player who is not a member why it is closed to them.

type FmTab = 'seances' | 'players' | 'profile';

const TABS: { id: FmTab; icon: IconName }[] = [
  { id: 'seances', icon: 'hammer' },
  { id: 'players', icon: 'users' },
  { id: 'profile', icon: 'user' },
];

export function ForgemagiePage({ priceMode }: { priceMode: PriceMode }) {
  const auth = useFmAuth();
  const [leaving, setLeaving] = useState(false);
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
            <a className="btn btn-primary" href={auth.loginUrl('/forgemagie')}>Se connecter avec Discord</a>
            <p className="fm-note">
              Seuls ton identifiant, ton pseudo et ton avatar Discord sont gardés. Discord te demandera aussi l'accès à la
              liste de tes serveurs : seul le nom de celui du groupe y est lu.
            </p>
          </div>
        )}

        {auth.status === 'connected' && auth.me && !auth.me.isMember && (
          <div className="fm-login">
            <EmptyState
              icon="users"
              title="Page réservée aux membres du serveur Discord"
              description={`La page Forgemagie est réservée aux membres du serveur Discord ${auth.me.guildName ? `« ${auth.me.guildName} »` : 'du groupe'}. Tu es connecté avec ton compte Discord, mais tu n'en fais pas partie.`}
            >
              <Link to={ROUTES.profile} className="btn btn-secondary">Voir mon profil</Link>
            </EmptyState>
          </div>
        )}

        {auth.status === 'connected' && auth.me?.isMember && (
          <>
            <div className="fm-account">
              <PlayerBadge player={{ discordUserId: auth.me.discordUserId, displayName: auth.me.displayName, avatarUrl: auth.me.avatarUrl, private: auth.me.isPrivate }} />
              <button
                type="button"
                className="btn btn-secondary btn-small"
                disabled={leaving}
                onClick={() => {
                  setLeaving(true);
                  void auth.logout().finally(() => setLeaving(false));
                }}
              >
                {leaving ? 'Déconnexion…' : 'Se déconnecter'}
              </button>
            </div>

            <div className="hdv-tabs" role="tablist" aria-label="Forgemagie">
              {TABS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  role="tab"
                  id={`fm-tab-${entry.id}`}
                  aria-selected={entry.id === tab}
                  aria-controls="fm-tabpanel"
                  tabIndex={entry.id === tab ? 0 : -1}
                  onKeyDown={(event) => {
                    const next = tabOnKey(event, TABS.map((candidate) => candidate.id), entry.id);
                    if (!next) return;
                    setTab(next);
                    if (next === 'seances') setOpenSeanceId(undefined);
                  }}
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

            <div className="tab-panel" role="tabpanel" id="fm-tabpanel" aria-labelledby={`fm-tab-${tab}`} key={tab}>
            {tab === 'seances' && (openSeanceId
              ? <SeanceDetail key={openSeanceId} seanceId={openSeanceId} me={auth.me} priceMode={priceMode} onBack={() => setOpenSeanceId(undefined)} onUnauthorized={auth.forget} />
              : <SeancesTab me={auth.me} onOpen={setOpenSeanceId} onUnauthorized={auth.forget} />)}
            {tab === 'players' && <PlayersTab onUnauthorized={auth.forget} />}
            {tab === 'profile' && <ProfileTab me={auth.me} updateMe={auth.updateMe} onDeleted={auth.forget} onOpenSeance={openSeance} onUnauthorized={auth.forget} />}
            </div>
          </>
        )}
      </section>
    </>
  );
}
