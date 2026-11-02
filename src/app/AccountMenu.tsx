import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icon } from '../components/Icon';
import type { FmMe, LoginError } from '../domain/forgemagie';
import { useAuth } from './AuthContext';
import { ROUTES } from './router';

// specs/075-connexion-discord-site: the right end of the top bar, on every page — « Se connecter avec Discord » for a
// visitor; for a logged-in player their Discord name and avatar opening a menu with
// their profile and the logout.

const LOGIN_ERROR_MESSAGES: Record<LoginError, string> = {
  cancelled: 'Connexion annulée : tu n\'as pas autorisé l\'accès sur Discord.',
  'login-failed': 'La connexion a échoué, réessaie.',
};

/** The player's Discord avatar, or their initial when they have none (or it does not load). */
export function AccountAvatar({ me }: { me: Pick<FmMe, 'avatarUrl' | 'displayName'> }) {
  const [avatarBroken, setAvatarBroken] = useState(false);
  useEffect(() => setAvatarBroken(false), [me.avatarUrl]);
  return (
    <span className="account-avatar-wrap">
      {me.avatarUrl && !avatarBroken ? (
        <img className="account-avatar" src={me.avatarUrl} alt="" width={28} height={28} onError={() => setAvatarBroken(true)} />
      ) : (
        <span className="account-avatar account-avatar--empty" aria-hidden="true">{me.displayName.charAt(0).toUpperCase() || '?'}</span>
      )}
    </span>
  );
}

export function AccountMenu() {
  const { status, me, loginError, dismissLoginError, loginUrl, logout } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      // The focus was inside the menu that has just gone: give it back to the button.
      if (rootRef.current?.contains(document.activeElement)) buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  // While the profile is read, a slot of the same size keeps the bar from jumping.
  if (status === 'loading') return <div className="account-menu account-menu--loading" aria-hidden="true" />;

  const message = loginError && (
    <div className="account-message" role="alert">
      <span>{LOGIN_ERROR_MESSAGES[loginError]}</span>
      <button type="button" className="icon-button icon-button--sm" aria-label="Fermer le message" onClick={dismissLoginError}>
        <Icon name="close" size={14} />
      </button>
    </div>
  );

  if (status !== 'connected' || !me) {
    return (
      <div className="account-menu">
        <a className="btn btn-secondary btn-small account-login" href={loginUrl(pathname)} aria-label="Se connecter avec Discord" title="Se connecter avec Discord">
          <Icon name="user" size={16} />
          <span className="account-login-label">Se connecter avec Discord</span>
        </a>
        {message}
      </div>
    );
  }

  return (
    <div
      className="account-menu"
      ref={rootRef}
      // Tabbing out of the menu closes it.
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="account-button"
        aria-expanded={open}
        aria-label={`Compte de ${me.displayName}`}
        onClick={() => setOpen((current) => !current)}
      >
        <AccountAvatar me={me} />
        <span className="account-name">{me.displayName}</span>
        <Icon name="chevron-down" size={16} />
      </button>
      {open && (
        <div className="account-menu-pop">
          <ul className="app-nav-menu-list">
            <li>
              <Link to={ROUTES.profile} className="app-nav-link" onClick={() => setOpen(false)}>
                <Icon name="user" size={20} />
                <span>Mon profil</span>
              </Link>
            </li>
            <li>
              <button
                type="button"
                className="app-nav-link account-logout"
                disabled={leaving}
                onClick={() => {
                  setLeaving(true);
                  void logout().finally(() => {
                    setLeaving(false);
                    setOpen(false);
                  });
                }}
              >
                <Icon name="log-out" size={20} />
                <span>{leaving ? 'Déconnexion…' : 'Se déconnecter'}</span>
              </button>
            </li>
          </ul>
        </div>
      )}
      {message}
    </div>
  );
}
