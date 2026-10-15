// Linear-interpolation percentile, matching PostgreSQL's percentile_cont(p) exactly — kept
// identical to the formula the previous Postgres-backed design used (specs/004-community-price-sharing
// research.md), so switching backends doesn't silently change what FR-010/FR-011 actually compute.
export function percentileCont(sorted: number[], p: number): number {
  const rank = p * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return sorted[lower];
  const weight = rank - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
}

// FR-010: bounds outside which a value is statistically aberrant, via the interquartile-range
// method. With too few points for a meaningful IQR (fewer than 4, or q3 - q1 = 0), nothing is
// excluded — mirrors the Postgres view's behavior from the previous design.
export function outlierBounds(sorted: number[]): [number, number] {
  if (sorted.length < 4) return [-Infinity, Infinity];
  const q1 = percentileCont(sorted, 0.25);
  const q3 = percentileCont(sorted, 0.75);
  const iqr = q3 - q1;
  if (iqr === 0) return [-Infinity, Infinity];
  return [q1 - 1.5 * iqr, q3 + 1.5 * iqr];
}

export function computeCommunityMedian(amounts: number[]): { medianAmountKamas: number; sampleSize: number } | undefined {
  if (amounts.length === 0) return undefined;
  const sorted = [...amounts].sort((a, b) => a - b);
  const [low, high] = outlierBounds(sorted);
  const filtered = sorted.filter((value) => value >= low && value <= high);
  if (filtered.length === 0) return undefined;
  return {
    medianAmountKamas: Math.round(percentileCont(filtered, 0.5)),
    sampleSize: filtered.length,
  };
}

// specs/025-rune-purchase-import: who or what recorded a price. Rows read without it count as manual.
// specs/056: 'sniffer' for a price sent by the friends' HDV tool (POST /community-price/batch).
export type PriceOrigin = 'manual' | 'capture' | 'bot' | 'sniffer';

export type ContributionRow = { amountKamas: number; createdAt: string; deviceId: string; origin?: PriceOrigin };

// specs/004-community-price-sharing FR-023 (révision 7): a device that corrects its price several
// times counts once, with its latest value — otherwise one player re-typing a price would show as
// "3 contributions" and weigh three times in the median. Rows from before device ids existed
// (empty deviceId) can't be told apart, so each still counts on its own.
export function latestPerDevice(rows: ContributionRow[]): ContributionRow[] {
  const latest = new Map<string, ContributionRow>();
  const anonymous: ContributionRow[] = [];
  for (const row of rows) {
    if (!row.deviceId) {
      anonymous.push(row);
      continue;
    }
    const current = latest.get(row.deviceId);
    if (!current || row.createdAt > current.createdAt) latest.set(row.deviceId, row);
  }
  return [...latest.values(), ...anonymous];
}

export type ContributionsSummary = {
  medianAmountKamas: number;
  sampleSize: number;
  lastContributionAt: string;
  latestAmountKamas: number;
  latestContributionAt: string;
  // specs/025-rune-purchase-import (FR-011): the origin of that latest contribution.
  latestOrigin: PriceOrigin;
};

// What GET /community-price returns: the median over one contribution per device, and the date of
// the most recent contribution actually kept in that median — never one excluded as aberrant.
// specs/024-latest-community-price: plus the latest contribution itself, over every row (no
// per-device grouping, no outlier filter) — the price the site now shows. On equal dates the last
// row wins: the queries read rows in insertion order, so it is the one recorded last.
export function summarizeContributions(rows: ContributionRow[]): ContributionsSummary | undefined {
  const kept = latestPerDevice(rows);
  const median = computeCommunityMedian(kept.map((row) => row.amountKamas));
  if (!median) return undefined;
  const [low, high] = outlierBounds(kept.map((row) => row.amountKamas).sort((a, b) => a - b));
  const lastContributionAt = kept
    .filter((row) => row.amountKamas >= low && row.amountKamas <= high)
    .reduce((latest, row) => (row.createdAt > latest ? row.createdAt : latest), '');
  const latest = rows.reduce((current, row) => (row.createdAt >= current.createdAt ? row : current));
  return {
    ...median,
    lastContributionAt,
    latestAmountKamas: latest.amountKamas,
    latestContributionAt: latest.createdAt,
    latestOrigin: latest.origin ?? 'manual',
  };
}
