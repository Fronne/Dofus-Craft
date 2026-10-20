// specs/065-refonte-page-brisage: the price of the item to break is the buying price (HDV), the cost of its craft
// chain, or — in Auto — the cheaper of the two. A price that is missing, zero or negative is UNKNOWN, never 0.

export type PriceChoice = 'hdv' | 'craft' | 'auto';
export type ResolvedPrice = { kamas: number; origin: 'hdv' | 'craft' };

const known = (kamas: number | undefined): kamas is number => typeof kamas === 'number' && Number.isFinite(kamas) && kamas > 0;

/** The price kept for the chosen source and where it comes from; undefined when it is unknown. Auto prefers the HDV on a tie. */
export function resolveItemPrice(hdvKamas: number | undefined, craftKamas: number | undefined, source: PriceChoice): ResolvedPrice | undefined {
  const hdv = known(hdvKamas) ? hdvKamas : undefined;
  const craft = known(craftKamas) ? craftKamas : undefined;
  if (source === 'hdv') return hdv === undefined ? undefined : { kamas: hdv, origin: 'hdv' };
  if (source === 'craft') return craft === undefined ? undefined : { kamas: craft, origin: 'craft' };
  if (hdv !== undefined && (craft === undefined || hdv <= craft)) return { kamas: hdv, origin: 'hdv' };
  return craft === undefined ? undefined : { kamas: craft, origin: 'craft' };
}
