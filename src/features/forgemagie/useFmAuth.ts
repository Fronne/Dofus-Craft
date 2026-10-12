import { useCallback, useEffect, useRef, useState } from 'react';
import { useActiveServer } from '../../app/ServerContext';
import { parseLoginFragment, type FmMe } from '../../domain/forgemagie';
import { clearFmSessionToken, readFmSessionToken, writeFmSessionToken } from '../../persistence/fm-session-token';
import { getFmMe, logoutFm, updateFmMe } from '../../services/fm-api';

// specs/025-rune-purchase-import (US1, research R3): the Forgemagie login. Back from Discord, the Worker
// leaves `#session=<token>` (or `#error=…`) in the address; it is read once, then removed from the
// address and the history so it is never shared or bookmarked.

export type FmAuthStatus = 'loading' | 'anonymous' | 'connected' | 'unavailable';
export type FmLoginError = 'not-member' | 'login-failed';

function consumeLoginFragment(): FmLoginError | undefined {
  const { token, error } = parseLoginFragment(window.location.hash);
  if (window.location.hash) {
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  }
  if (token) writeFmSessionToken(token);
  return error;
}

export function useFmAuth() {
  const { serverId } = useActiveServer();
  const [loginError] = useState<FmLoginError | undefined>(consumeLoginFragment);
  const [status, setStatus] = useState<FmAuthStatus>(() => (readFmSessionToken() ? 'loading' : 'anonymous'));
  const [me, setMe] = useState<FmMe | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Without a token, the initial state already says « anonymous ».
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

  const logout = useCallback(async () => {
    await logoutFm();
    clearFmSessionToken();
    setMe(undefined);
    setStatus('anonymous');
  }, []);

  /** After the profile was deleted: the session no longer exists on the Worker. */
  const forget = useCallback(() => {
    clearFmSessionToken();
    setMe(undefined);
    setStatus('anonymous');
  }, []);

  const updateMe = useCallback(async (changes: { serverId?: string; isPrivate?: boolean }) => {
    const result = await updateFmMe(changes);
    if (result.status === 'ok') setMe(result.data);
    if (result.status === 'unauthorized') forget();
    return result.status === 'ok';
  }, [forget]);

  return { status, me, loginError, logout, forget, updateMe, retry };
}
