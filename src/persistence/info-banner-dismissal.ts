// specs/020-info-banner FR-004: the version of the last information message the player closed, kept
// on this device only. Unavailable storage just means nothing is closed — never an exception.
const STORAGE_KEY = 'craftcheck-info-banner-dismissed';

export function readDismissedVersion(): string | undefined {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function dismissVersion(version: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, version);
  } catch {
    // localStorage unavailable — the banner stays closed for this visit only.
  }
}
