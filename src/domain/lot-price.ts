// specs/058-prix-par-lot: which HDV lot size prices a quantity. The HDV sells by lots of 1, 10, 100 or
// 1000, and a lot is cheaper per unit than the singles: a quantity of 250 is bought as lots of 100.

export const LOT_SIZES = [1, 10, 100, 1000] as const;
export type LotSize = (typeof LOT_SIZES)[number];

export type LotUnitPrice = { unitPriceKamas: number; date?: string };
/** The unit price known for each lot size; absent or 0: unknown. */
export type LotUnitPrices = Partial<Record<LotSize, LotUnitPrice>>;

export type PickedLotPrice = LotUnitPrice & { lotSize: LotSize };

/**
 * The price for buying `quantity` units: the biggest lot not above `quantity` that has a price, else the
 * next smaller one, down to the lot of 1 — never a lot bigger than the quantity (the player would buy
 * units they do not need). Undefined when no lot up to that size has a price.
 */
export function pickLotPrice(quantity: number, lots: LotUnitPrices): PickedLotPrice | undefined {
  for (const lotSize of [...LOT_SIZES].reverse()) {
    if (lotSize > quantity) continue;
    const price = lots[lotSize];
    if (price && price.unitPriceKamas > 0) return { lotSize, ...price };
  }
  return undefined;
}
