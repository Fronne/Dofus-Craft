// Linear-interpolation percentile, matching PostgreSQL's percentile_cont(p) exactly — kept
// identical to the formula the previous Postgres-backed design used (specs/004-community-price-sharing
// research.md), so switching backends doesn't silently change what FR-010/FR-011 actually compute.
function percentileCont(sorted: number[], p: number): number {
  const rank = p * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return sorted[lower];
  const weight = rank - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
}

// FR-010: exclude statistically aberrant values via the interquartile-range method before
// computing the median. With too few points for a meaningful IQR (q3 - q1 = 0), nothing is
// excluded — mirrors the Postgres view's behavior from the previous design.
function excludeOutliers(sorted: number[]): number[] {
  if (sorted.length < 4) return sorted;
  const q1 = percentileCont(sorted, 0.25);
  const q3 = percentileCont(sorted, 0.75);
  const iqr = q3 - q1;
  if (iqr === 0) return sorted;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  return sorted.filter((value) => value >= lowerBound && value <= upperBound);
}

export function computeCommunityMedian(amounts: number[]): { medianAmountKamas: number; sampleSize: number } | undefined {
  if (amounts.length === 0) return undefined;
  const sorted = [...amounts].sort((a, b) => a - b);
  const filtered = excludeOutliers(sorted);
  if (filtered.length === 0) return undefined;
  return {
    medianAmountKamas: Math.round(percentileCont(filtered, 0.5)),
    sampleSize: filtered.length,
  };
}
