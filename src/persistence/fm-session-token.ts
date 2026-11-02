// specs/025-rune-purchase-import (research R3): the Forgemagie session token, sent as a bearer token to
// the Worker's /fm/* routes. Storage can be unavailable (private window, blocked site data): the player
// is then simply logged out.
// specs/075-connexion-discord-site: the same token now serves the whole site; the key is kept so the sessions
// opened from the Forgemagie before stay valid.
export const FM_SESSION_TOKEN_KEY = 'dofus-craft:fm-session-token';
const KEY = FM_SESSION_TOKEN_KEY;

export function readFmSessionToken(): string | undefined {
  try {
    return window.localStorage.getItem(KEY) || undefined;
  } catch {
    return undefined;
  }
}

export function writeFmSessionToken(token: string): void {
  try {
    window.localStorage.setItem(KEY, token);
  } catch {
    // Without storage, the login lasts only as long as the page stays open.
  }
}

export function clearFmSessionToken(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing stored, nothing to clear.
  }
}
