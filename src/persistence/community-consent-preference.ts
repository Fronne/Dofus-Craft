const STORAGE_KEY = 'craftcheck-community-consent';

export function getShareConsent(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setShareConsent(given: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, given ? 'true' : 'false');
  } catch {
    // localStorage unavailable — the consent choice just won't survive a reload.
  }
}
