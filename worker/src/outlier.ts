// specs/007-outlier-confirmation, FR-002/FR-009: how far a submitted amount deviates from the
// community median already known by the server, computed just before inserting a new contribution.
// Deliberately duplicated from src/domain/outlier-threshold.ts (see research.md) rather than
// shared — client and Worker are separate, independently-built projects with no code-sharing
// mechanism between them in this repo.
export const OUTLIER_THRESHOLD_PERCENT = 25;

export function computeDeviationPercent(amountKamas: number, medianAmountKamas: number): number {
  return Math.abs(amountKamas - medianAmountKamas) / medianAmountKamas * 100;
}

// FR-008: no prior median for this resource/server (this contribution is the first, or the only
// ones on record) — both fields are null, never a fabricated comparison.
export function resolveOutlierFields(
  amountKamas: number,
  currentMedian: { medianAmountKamas: number } | undefined,
): { medianAtSubmissionKamas: number | null; deviationPercent: number | null } {
  if (!currentMedian) return { medianAtSubmissionKamas: null, deviationPercent: null };
  return {
    medianAtSubmissionKamas: currentMedian.medianAmountKamas,
    deviationPercent: computeDeviationPercent(amountKamas, currentMedian.medianAmountKamas),
  };
}
