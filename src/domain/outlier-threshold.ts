// specs/007-outlier-confirmation, FR-002/FR-003: how far a player's entered price deviates from
// the community median already known client-side, before deciding whether to gate the commit
// behind a confirmation. Deliberately duplicated in worker/src/outlier.ts (see research.md) rather
// than shared — client and Worker are separate, independently-built projects with no code-sharing
// mechanism between them in this repo.
export const OUTLIER_THRESHOLD_PERCENT = 25;

export function computeDeviationPercent(enteredAmountKamas: number, medianAmountKamas: number): number {
  return Math.abs(enteredAmountKamas - medianAmountKamas) / medianAmountKamas * 100;
}

// specs/016-shared-item-prices FR-006/FR-008: an item's HDV price is compared with the latest shared
// price shown (no median), with a wider threshold than resources — item prices move more.
export const ITEM_OUTLIER_THRESHOLD_PERCENT = 50;

export function needsItemPriceConfirmation(enteredAmountKamas: number, latestAmountKamas: number | undefined): boolean {
  if (latestAmountKamas === undefined) return false;
  if (latestAmountKamas === 0) return enteredAmountKamas !== 0;
  return computeDeviationPercent(enteredAmountKamas, latestAmountKamas) > ITEM_OUTLIER_THRESHOLD_PERCENT;
}
