// specs/007-outlier-confirmation, FR-002/FR-003: how far a player's entered price deviates from
// the community median already known client-side, before deciding whether to gate the commit
// behind a confirmation. Deliberately duplicated in worker/src/outlier.ts (see research.md) rather
// than shared — client and Worker are separate, independently-built projects with no code-sharing
// mechanism between them in this repo.
export const OUTLIER_THRESHOLD_PERCENT = 25;

export function computeDeviationPercent(enteredAmountKamas: number, medianAmountKamas: number): number {
  return Math.abs(enteredAmountKamas - medianAmountKamas) / medianAmountKamas * 100;
}
