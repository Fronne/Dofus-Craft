// specs/025-rune-purchase-import (research R3): the Forgemagie session token, sent as a bearer token to
// the Worker's /fm/* routes. Storage can be unavailable (private window, blocked site data): the player
// is then simply logged out.
const KEY = 'dofus-craft:fm-session-token';

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
