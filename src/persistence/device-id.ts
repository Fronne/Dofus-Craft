// Generic anonymous device identifier, shared by every feature that needs one (specs/004-community-price-sharing
// revision 5, specs/006-anonymous-visit-count). Never throws: if localStorage is unavailable
// (private browsing, quota, disabled storage), a freshly generated id is still returned so the
// caller is never blocked — only the ability to recognize it on a later call is lost. Each caller
// passes its own storage key so different features never share the same identifier.
export function createDeviceId(storageKey: string): string {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) return stored;
  } catch {
    return crypto.randomUUID();
  }
  const id = crypto.randomUUID();
  try {
    window.localStorage.setItem(storageKey, id);
  } catch {
    // Unable to persist — the id is still returned for this call, just not remembered.
  }
  return id;
}
