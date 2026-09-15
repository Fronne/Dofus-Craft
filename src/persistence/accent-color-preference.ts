import { isKnownAccentColorId } from '../domain/accent-colors';
import type { AccentColorId } from '../domain/accent-colors';

const STORAGE_KEY = 'craftcheck-accent-color';
const DEFAULT_ACCENT_COLOR_ID: AccentColorId = 'blue';

export function getAccentColorId(): AccentColorId {
  let stored: string | null;
  try {
    stored = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return DEFAULT_ACCENT_COLOR_ID;
  }
  if (!stored || !isKnownAccentColorId(stored)) return DEFAULT_ACCENT_COLOR_ID;
  return stored;
}

export function setAccentColorId(accentColorId: AccentColorId): void {
  if (!isKnownAccentColorId(accentColorId)) throw new Error("Couleur d'accent inconnue");
  window.localStorage.setItem(STORAGE_KEY, accentColorId);
}
