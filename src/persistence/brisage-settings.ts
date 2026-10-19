import { defaultBrisageSettings, mergeBrisageSettings, type BrisageSettings } from '../domain/brisage';

// specs/060-page-brisage (FR-007): the weights and yields of the Brisage page, kept on the device.
const STORAGE_KEY = 'craftcheck-brisage-settings';

export function getBrisageSettings(): BrisageSettings {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === null ? defaultBrisageSettings() : mergeBrisageSettings(JSON.parse(stored));
  } catch {
    return defaultBrisageSettings();
  }
}

export function setBrisageSettings(settings: BrisageSettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Private browsing or blocked storage: the settings just aren't remembered.
  }
}

export function resetBrisageSettings(): BrisageSettings {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clean.
  }
  return defaultBrisageSettings();
}
