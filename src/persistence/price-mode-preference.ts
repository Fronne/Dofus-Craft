import { isKnownPriceMode } from '../domain/price-modes';
import type { PriceMode } from '../domain/price-modes';

// Renamed on 2026-09-24 (specs/003, révision « bascule des joueurs existants »): every device that
// already had a mode saved under the old key starts over in Mode communautaire once; a choice made
// after that is kept as usual. The personal carnet itself is untouched and still there to switch back to.
const STORAGE_KEY = 'craftcheck-price-mode-choice';
// specs/003-community-price-mode (révision 2026-09-24): a new player starts in Mode communautaire.
// Falls back to Mode personnel while the community mode is switched off (price-modes.ts).
const DEFAULT_PRICE_MODE: PriceMode = isKnownPriceMode('community') ? 'community' : 'personal';

export function getPriceMode(): PriceMode {
  let stored: string | null;
  try {
    stored = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return DEFAULT_PRICE_MODE;
  }
  if (!stored || !isKnownPriceMode(stored)) return DEFAULT_PRICE_MODE;
  return stored;
}

export function setPriceMode(mode: PriceMode): void {
  if (!isKnownPriceMode(mode)) throw new Error('Mode de gestion des prix inconnu');
  window.localStorage.setItem(STORAGE_KEY, mode);
}
