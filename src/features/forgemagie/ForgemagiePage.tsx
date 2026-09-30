import { useState } from 'react';
import { EmptyState } from '../../components/EmptyState';
import { FmItemRecap } from './FmItemRecap';
import type { PriceMode } from '../../domain/price-modes';
import { fmLoginUrl } from '../../services/fm-api';
import { PlayerBadge } from './PlayerBadge';
import { ProfileTab } from './ProfileTab';
import { SessionDetail } from './SessionDetail';
import { SessionsTab } from './SessionsTab';
import { useFmAuth } from './useFmAuth';

// specs/025-rune-purchase-import: the Forgemagie page, for members of the group's Discord server only
// (FR-001, FR-002). The rest of the site stays anonymous (FR-003).

// specs/026-hdv-rune-prices: the rune prices moved to the HDV page; the capture import is in Profil.
type FmTab = 'sessions' | 'profile';

const TABS: { id: FmTab; label: string }[] = [
  { id: 'sessions', label: 'Sessions' },
  { id: 'profile', label: 'Profil' },
];

const LOGIN_ERRORS = {
  'not-member': 'La page Forgemagie est réservée aux membres du serveur Discord du groupe.',
  'login-failed': 'La connexion a échoué, réessaie.',
};

export function ForgemagiePage({ priceMode }: { priceMode: PriceMode }) {
  const auth = useFmAuth();
  const [tab, setTab] = useState<FmTab>('sessions');
  const [openSessionId, setOpenSessionId] = useState<string | undefined>(undefined);
  // specs/027-fm-item-recap: the recap of an item in FM, opened from the Profil tab.
  const [openItemId, setOpenItemId] = useState<string | undefined>(undefined);

  const openSession = (sessionId: string) => {
    setOpenSessionId(sessionId);
    setTab('sessions');
  };
  const goToProfile = () => {
    setOpenItemId(undefined);
    setTab('profile');
  };

  return (
    <>
      <header className="page-header">
        <h1>Forgemagie</h1>
        <p>Les sessions FM du bot Discord et les dépenses de chacun.</p>
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
              Connecte-toi avec ton compte Discord pour retrouver les sessions FM du bot et ce que chacun a
              dépensé. Le prix des runes est dans la page HDV, onglet Runes.
            </p>
            {auth.loginError && <p className="fm-error" role="alert">{LOGIN_ERRORS[auth.loginError]}</p>}
            <a className="btn btn-primary" href={fmLoginUrl()}>Se connecter avec Discord</a>
            <p className="fm-note">Seuls ton identifiant, ton pseudo et ton avatar Discord sont gardés.</p>
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
                  className={`hdv-tab${entry.id === tab ? ' hdv-tab--active' : ''}`}
                  onClick={() => {
                    setTab(entry.id);
                    if (entry.id === 'sessions') setOpenSessionId(undefined);
                    if (entry.id === 'profile') setOpenItemId(undefined);
                  }}
                >
                  {entry.label}
                </button>
              ))}
            </div>

            {tab === 'sessions' && (openSessionId
              ? <SessionDetail sessionId={openSessionId} me={auth.me} onBack={() => setOpenSessionId(undefined)} onUnauthorized={auth.forget} onGoToProfile={goToProfile} />
              : <SessionsTab onOpen={setOpenSessionId} onUnauthorized={auth.forget} />)}
            {tab === 'profile' && (openItemId
              ? <FmItemRecap itemId={openItemId} onBack={() => setOpenItemId(undefined)} onOpenSession={openSession} onUnauthorized={auth.forget} />
              : <ProfileTab me={auth.me} priceMode={priceMode} updateMe={auth.updateMe} onDeleted={auth.forget} onOpenSession={openSession} onOpenItem={setOpenItemId} onUnauthorized={auth.forget} />)}
          </>
        )}
      </section>
    </>
  );
}
