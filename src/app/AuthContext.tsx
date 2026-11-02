import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useActiveServer } from './ServerContext';
import { parseLoginFragment, type FmMe, type LoginError } from '../domain/forgemagie';
import {
  clearFmSessionToken, FM_SESSION_TOKEN_KEY, readFmSessionToken, writeFmSessionToken,
} from '../persistence/fm-session-token';
import { fmLoginUrl, getFmMe, logoutFm, updateFmMe } from '../services/fm-api';

// specs/075-connexion-discord-site: the Discord login of the whole site, no longer only the Forgemagie's.
// Back from Discord, the Worker leaves `#session=<token>` (or `#error=…`) in the address; it is read once,
// then removed from the address and the history so it is never shared or bookmarked. A site opened without a
// token makes no call at all: the visitor is simply anonymous.

export type AuthStatus = 'loading' | 'anonymous' | 'connected' | 'unavailable';

export type ProfileChanges = { serverId?: string; isPrivate?: boolean; breedId?: number | null };

export type AuthValue = {
  status: AuthStatus;
  me: FmMe | undefined;
  /** Why the login that just ended did not give a session, until the player closes the message. */
  loginError: LoginError | undefined;
  dismissLoginError: () => void;
  /** Where « Se connecter avec Discord » leads, then back to `returnPath` (the current page by default). */
  loginUrl: (returnPath?: string) => string;
  logout: () => Promise<void>;
  /** After the profile was deleted: the session no longer exists on the Worker. */
  forget: () => void;
  updateMe: (changes: ProfileChanges) => Promise<boolean>;
  retry: () => void;
};

const AuthContext = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { serverId } = useActiveServer();
  // Read without touching the address (the initializer may run twice, in development); the effect below
  // is what stores the token and cleans the address.
  const [fragment] = useState(() => parseLoginFragment(window.location.hash));
  const [loginError, setLoginError] = useState<LoginError | undefined>(fragment.error);
  const [status, setStatus] = useState<AuthStatus>(() => (fragment.token || readFmSessionToken() ? 'loading' : 'anonymous'));
  const [me, setMe] = useState<FmMe | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);

  // Declared before the effect that reads the profile: effects run in order, so the token is stored by then.
  useEffect(() => {
    if (!fragment.token && !fragment.error) return;
    if (fragment.token) writeFmSessionToken(fragment.token);
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  }, [fragment]);

  useEffect(() => {
    if (!readFmSessionToken()) return;
    let cancelled = false;
    void (async () => {
      const result = await getFmMe();
      if (cancelled) return;
      if (result.status !== 'ok') {
        setStatus(result.status === 'unauthorized' || result.status === 'not-found' ? 'anonymous' : 'unavailable');
        return;
      }
      setMe(result.data);
      setStatus('connected');
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // The token changed in another tab: logged out there, the visitor is anonymous here; logged in there, the profile
  // is read again.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== FM_SESSION_TOKEN_KEY) return;
      if (readFmSessionToken()) {
        setAttempt((value) => value + 1);
        return;
      }
      setMe(undefined);
      setStatus('anonymous');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // specs/049-fm-seances: the profile's server follows the site's — the purchases are filed on the
  // server chosen for the whole site. A server that could not be saved is not asked again.
  const profileServerId = me?.serverId;
  const askedServerId = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (status !== 'connected' || profileServerId === undefined || !serverId) return;
    if (profileServerId === serverId || askedServerId.current === serverId) return;
    askedServerId.current = serverId;
    let cancelled = false;
    void updateFmMe({ serverId }).then((result) => {
      if (!cancelled && result.status === 'ok') setMe(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [status, profileServerId, serverId]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const dismissLoginError = useCallback(() => setLoginError(undefined), []);
  const loginUrl = useCallback((returnPath?: string) => fmLoginUrl(returnPath), []);

  const forget = useCallback(() => {
    clearFmSessionToken();
    setMe(undefined);
    setStatus('anonymous');
  }, []);

  const logout = useCallback(async () => {
    await logoutFm();
    forget();
  }, [forget]);

  const updateMe = useCallback(async (changes: ProfileChanges) => {
    const result = await updateFmMe(changes);
    if (result.status === 'ok') setMe(result.data);
    if (result.status === 'unauthorized') forget();
    return result.status === 'ok';
  }, [forget]);

  const value = useMemo<AuthValue>(
    () => ({ status, me, loginError, dismissLoginError, loginUrl, logout, forget, updateMe, retry }),
    [status, me, loginError, dismissLoginError, loginUrl, logout, forget, updateMe, retry],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside an AuthProvider');
  return value;
}
