// specs/008-stale-resource-highlight: how long ago a resource's price was last updated, used to
// flag a row as visually "stale" or "expired" rather than presenting an old price as authoritative
// (Constitution I).
export const PRICE_AGE_STALE_DAYS = 3;
export const PRICE_AGE_EXPIRED_DAYS = 7;

export type PriceAgeStatus = 'unknown' | 'fresh' | 'stale' | 'expired';

export function classifyPriceAge(updatedAt: string | undefined, now: Date = new Date()): PriceAgeStatus {
  if (!updatedAt) return 'unknown';

  const ageDays = (now.getTime() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays >= PRICE_AGE_EXPIRED_DAYS) return 'expired';
  if (ageDays >= PRICE_AGE_STALE_DAYS) return 'stale';
  return 'fresh';
}
