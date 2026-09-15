import { isKnownPriceMode } from '../domain/price-modes';
import type { PriceMode } from '../domain/price-modes';

const STORAGE_KEY = 'craftcheck-price-mode';
const DEFAULT_PRICE_MODE: PriceMode = 'personal';

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
