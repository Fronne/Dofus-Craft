// specs/081-bons-plans-aide-acces (US2, FR-006, FR-007): the owner keeps the Bons plans page for themselves while the
// administration turns it off, by opening the site once per browser with `?bonsplans=1` (and `?bonsplans=0` to stop).
// As for the ranking of specs/072, this is a setting kept in the browser, not an authentication: anyone who knows the
// address can turn it on. It is accepted because the announcements are public data of the HDV. Storage that cannot be
// read means « no access ».

const STORAGE_KEY = 'dofus-craft-bons-plans-access';
const PARAMETER = 'bonsplans';

export function hasBonsPlansAccess(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function setBonsPlansAccess(granted: boolean): void {
  try {
    if (granted) window.localStorage.setItem(STORAGE_KEY, '1');
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Blocked storage: the access is not kept, so it stays refused.
  }
}

/**
 * Reads `bonsplans=1` / `bonsplans=0` from the address, applies it, and says what the access is now.
 * `touched` is true when the parameter was one of the two, so the caller can take it off the address.
 */
export function applyBonsPlansAccessFromSearch(search: string): { access: boolean; touched: boolean } {
  const value = new URLSearchParams(search).get(PARAMETER);
  if (value === '1' || value === '0') {
    setBonsPlansAccess(value === '1');
    return { access: hasBonsPlansAccess(), touched: true };
  }
  return { access: hasBonsPlansAccess(), touched: false };
}

/** The address without the `bonsplans` parameter (path, other parameters and hash are kept). */
export function withoutBonsPlansParameter(location: Pick<Location, 'pathname' | 'search' | 'hash'>): string {
  const params = new URLSearchParams(location.search);
  params.delete(PARAMETER);
  const rest = params.toString();
  return `${location.pathname}${rest ? `?${rest}` : ''}${location.hash}`;
}
