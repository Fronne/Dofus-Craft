// specs/056-sniffer-batch-prices: the unit price kept from an HDV price ladder sent by the friends' tool
// (the « Règle du prix unitaire » of the SniffSniffSquared plan 2026-10-15-friends-price-upload.md).
// Computed here rather than in the tool so the rule can change without shipping a new tool.

// Both are estimates: no resource ladder had been captured when they were chosen. Recalibrate them on
// captured ladders after a few weeks of uploads.
// A lot whose unit price is more than this factor away (above or below) from the other lots is aberrant.
export const LADDER_OUTLIER_FACTOR = 3;
// The biggest lot is kept unless its unit price is more than this much above the cheapest lot kept.
export const BIGGER_LOT_MAX_PREMIUM = 0.2;

export const LOT_SIZES = [1, 10, 100, 1000] as const;
export type LotSize = (typeof LOT_SIZES)[number];
// The price of a whole lot; 0 or absent: not on sale.
export type Ladder = Partial<Record<LotSize, number>>;

export type UnitPrice = { unitPriceKamas: number; lotSize: LotSize };

type Lot = { size: LotSize; unit: number };

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function isAberrant(unit: number, reference: number): boolean {
  return unit > reference * LADDER_OUTLIER_FACTOR || unit < reference / LADDER_OUTLIER_FACTOR;
}

// Step 5: the biggest lot, unless its unit price is more than BIGGER_LOT_MAX_PREMIUM above the cheapest
// lot kept — then the next smaller lot, tested again. The cheapest lot always passes, so a lot is found.
// The aim: a price at which the quantity can really be bought.
function biggestFairLot(lots: Lot[]): Lot {
  const cheapest = Math.min(...lots.map((lot) => lot.unit));
  const bySizeDescending = [...lots].sort((a, b) => b.size - a.size);
  return bySizeDescending.find((lot) => lot.unit <= cheapest * (1 + BIGGER_LOT_MAX_PREMIUM)) ?? bySizeDescending[0];
}

// Undefined only when no lot is on sale; otherwise a price is always kept (step 6).
export function unitPrice(ladder: Ladder, communityMedian?: number): UnitPrice | undefined {
  // Step 1: the unit price of each lot on sale.
  const lots: Lot[] = LOT_SIZES
    .filter((size) => (ladder[size] ?? 0) > 0)
    .map((size) => ({ size, unit: (ladder[size] as number) / size }));
  if (lots.length === 0) return undefined;

  let chosen: Lot;
  if (lots.length === 1) {
    // Step 2: a single lot is taken as is.
    chosen = lots[0];
  } else if (lots.length === 2) {
    // Step 3: two lots that agree go to step 5; two that disagree are settled by the community median
    // (the closer lot, on a ratio scale), or without one by the biggest lot.
    const [small, big] = lots;
    if (!isAberrant(big.unit, small.unit)) {
      chosen = biggestFairLot(lots);
    } else if (communityMedian !== undefined && communityMedian > 0) {
      const distance = (lot: Lot) => Math.abs(Math.log(lot.unit / communityMedian));
      chosen = distance(small) < distance(big) ? small : big;
    } else {
      chosen = big;
    }
  } else {
    // Step 4: a lot far from the median of the *other* lots of the same ladder is set aside. The
    // community median is not consulted: when every lot moved together, it is a real price move.
    const kept = lots.filter((lot) => !isAberrant(lot.unit, median(lots.filter((other) => other !== lot).map((other) => other.unit))));
    // Step 6: if everything was set aside (should not happen), step 5 on every lot.
    chosen = biggestFairLot(kept.length > 0 ? kept : lots);
  }
  return { unitPriceKamas: chosen.unit, lotSize: chosen.size };
}
