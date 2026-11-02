import type { CommunityPrice } from '../../domain/types';
import { isPriceOrigin } from '../../domain/forgemagie';
import { HISTORY_WINDOWS, type PriceHistory, type SharedPrice } from '../../domain/price-history';
import { isRecord } from './http';

// specs/024-latest-community-price: the latest price and its date are required — an answer without
// them (an older Worker) is unusable rather than guessed from the median.
export function isCommunityPriceRow(value: unknown): value is CommunityPrice {
  return isRecord(value) &&
    typeof value.resourceId === 'string' &&
    typeof value.serverId === 'string' &&
    typeof value.medianAmountKamas === 'number' &&
    typeof value.sampleSize === 'number' &&
    typeof value.latestAmountKamas === 'number' &&
    typeof value.latestContributionAt === 'string';
}

// specs/025-rune-purchase-import: `latestOrigin` is optional (an older Worker doesn't send it) and an
// unknown value is dropped rather than shown — the page then shows it as a manual entry.
// specs/046-hdv-huzounet-load: `latestFragile` only means something for a price read on Huzounet.
export function withKnownOrigin(price: CommunityPrice): CommunityPrice {
  const latestOrigin = isPriceOrigin(price.latestOrigin) ? price.latestOrigin : undefined;
  const latestFragile = latestOrigin === 'external' && (price.latestFragile === 'stale' || price.latestFragile === 'provisional')
    ? price.latestFragile
    : undefined;
  // specs/082: an author that is not a plain name is dropped, never shown.
  const latestAuthor = typeof price.latestAuthor === 'string' && price.latestAuthor !== '' ? price.latestAuthor : undefined;
  if (latestOrigin === price.latestOrigin && latestFragile === price.latestFragile && latestAuthor === price.latestAuthor) return price;
  return { ...price, latestOrigin, latestFragile, latestAuthor };
}

export function knownAuthor(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

export type LatestItemPrice = { itemId: string; serverId: string; amountKamas: number; contributedAt: string; author?: string };

export function isLatestItemPriceRow(value: unknown): value is LatestItemPrice {
  return isRecord(value) &&
    typeof value.itemId === 'string' &&
    typeof value.serverId === 'string' &&
    typeof value.amountKamas === 'number' &&
    typeof value.contributedAt === 'string';
}

export function isSharedPrice(value: unknown): value is SharedPrice {
  return isRecord(value) && typeof value.amountKamas === 'number' && typeof value.sharedAt === 'string';
}

export function isPriceHistory(value: unknown): value is PriceHistory {
  return isRecord(value) &&
    HISTORY_WINDOWS.every((window) => Array.isArray(value[window]) && (value[window] as unknown[]).every(isSharedPrice));
}

export type SharedItemPriceEntry = { itemId: string; amountKamas: number; contributedAt: string; author?: string };

export function isSharedItemPriceEntry(value: unknown): value is SharedItemPriceEntry {
  return isRecord(value) &&
    typeof value.itemId === 'string' &&
    typeof value.amountKamas === 'number' &&
    typeof value.contributedAt === 'string';
}
