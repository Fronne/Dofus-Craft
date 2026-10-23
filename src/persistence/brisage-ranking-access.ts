// specs/072-classement-brisage (US6, FR-011, FR-012): who sees the ranking tab of the Brisage page. For now only the
// owner, who turns it on in their own browser by opening the page with `?classement=1` (and off with `?classement=0`).
// This is a setting kept in the browser, not an authentication: anyone who knows the address can turn it on for
// themselves. It is accepted because the ranking shows no private data. Storage that cannot be read means « no access ».

const STORAGE_KEY = 'craftcheck-brisage-ranking';
const PARAMETER = 'classement';

export function hasRankingAccess(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function setRankingAccess(granted: boolean): void {
  try {
    if (granted) window.localStorage.setItem(STORAGE_KEY, '1');
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Blocked storage: the access is not kept, so it stays refused.
  }
}

/**
 * Reads `classement=1` / `classement=0` from the address, applies it, and says what the access is now.
 * `touched` is true when the parameter was one of the two, so the caller can take it off the address.
 */
export function applyRankingAccessFromSearch(search: string): { access: boolean; touched: boolean } {
  const value = new URLSearchParams(search).get(PARAMETER);
  if (value === '1' || value === '0') {
    setRankingAccess(value === '1');
    return { access: hasRankingAccess(), touched: true };
  }
  return { access: hasRankingAccess(), touched: false };
}

/** The address without the `classement` parameter (path, other parameters and hash are kept). */
export function withoutRankingParameter(location: Pick<Location, 'pathname' | 'search' | 'hash'>): string {
  const params = new URLSearchParams(location.search);
  params.delete(PARAMETER);
  const rest = params.toString();
  return `${location.pathname}${rest ? `?${rest}` : ''}${location.hash}`;
}
