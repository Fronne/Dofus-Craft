import { useAuth } from '../../app/AuthContext';

// specs/025-rune-purchase-import (US1, research R3): the Forgemagie login.
// specs/075-connexion-discord-site: the login now serves the whole site — the session, the profile and the
// logout live in the site's AuthContext (src/app/AuthContext.tsx). This keeps the shape the Forgemagie page and
// its tabs were written against.
export type { AuthStatus as FmAuthStatus } from '../../app/AuthContext';

export function useFmAuth() {
  const { status, me, logout, forget, updateMe, retry, loginUrl } = useAuth();
  return { status, me, logout, forget, updateMe, retry, loginUrl };
}
