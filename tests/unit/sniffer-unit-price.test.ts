import { describe, expect, it } from 'vitest';
import { BIGGER_LOT_MAX_PREMIUM, LADDER_OUTLIER_FACTOR, unitPrice, type Ladder } from '../../worker/src/unit-price';

// specs/056-sniffer-batch-prices: the « Règle du prix unitaire », one row per branch.
describe('unitPrice (specs/056)', () => {
  it('uses the planned estimates', () => {
    expect(LADDER_OUTLIER_FACTOR).toBe(3);
    expect(BIGGER_LOT_MAX_PREMIUM).toBe(0.1);
  });

  const cases: { name: string; ladder: Ladder; median?: number; expected: { unitPriceKamas: number; lotSize: number } | undefined }[] = [
    { name: 'no lot on sale: no price', ladder: {}, expected: undefined },
    { name: 'every lot at 0: no price', ladder: { 1: 0, 10: 0, 100: 0, 1000: 0 }, expected: undefined },
    { name: 'a single lot is taken as is (step 2)', ladder: { 100: 2_290_000 }, expected: { unitPriceKamas: 22_900, lotSize: 100 } },
    { name: 'a single aberrant lot is still taken, the median is not consulted', ladder: { 1: 999_999 }, median: 100, expected: { unitPriceKamas: 999_999, lotSize: 1 } },
    { name: 'two close lots: the biggest (steps 3 then 5)', ladder: { 1: 24_000, 10: 231_000 }, expected: { unitPriceKamas: 23_100, lotSize: 10 } },
    { name: 'two close lots, the biggest more than 10 % above their median: the smaller', ladder: { 10: 100_000, 100: 1_300_000 }, expected: { unitPriceKamas: 10_000, lotSize: 10 } },
    { name: 'two lots 20 % apart: the biggest is within 10 % of their median and kept', ladder: { 10: 100_000, 100: 1_200_000 }, expected: { unitPriceKamas: 12_000, lotSize: 100 } },
    { name: 'two lots exactly a factor 3 apart still agree', ladder: { 1: 300, 10: 1_000 }, expected: { unitPriceKamas: 100, lotSize: 10 } },
    { name: 'two lots in disagreement, with a median: the closer lot (the smaller)', ladder: { 1: 25_000, 100: 500_000 }, median: 20_000, expected: { unitPriceKamas: 25_000, lotSize: 1 } },
    { name: 'two lots in disagreement, with a median: the closer lot (the bigger)', ladder: { 1: 100_000, 100: 2_000_000 }, median: 21_000, expected: { unitPriceKamas: 20_000, lotSize: 100 } },
    { name: 'two lots in disagreement, without a median: the biggest lot', ladder: { 1: 100_000, 100: 2_000_000 }, expected: { unitPriceKamas: 20_000, lotSize: 100 } },
    { name: 'x1 aberrant, x10 and x100 close: x1 set aside, then x100', ladder: { 1: 100_000, 10: 231_000, 100: 2_290_000 }, expected: { unitPriceKamas: 22_900, lotSize: 100 } },
    { name: 'x1 aberrant even with a median closer to it: the median is not consulted with 3 lots', ladder: { 1: 100_000, 10: 231_000, 100: 2_290_000 }, median: 100_000, expected: { unitPriceKamas: 22_900, lotSize: 100 } },
    { name: 'x1000 aberrantly cheap among four lots: set aside', ladder: { 1: 24_000, 10: 231_000, 100: 2_290_000, 1000: 2_000_000 }, expected: { unitPriceKamas: 22_900, lotSize: 100 } },
    { name: 'every lot doubled against the median: the new price is recorded', ladder: { 1: 48_000, 10: 462_000, 100: 4_580_000, 1000: 45_000_000 }, median: 22_900, expected: { unitPriceKamas: 45_000, lotSize: 1000 } },
    { name: 'four close lots, the biggest too dear: one lot down', ladder: { 1: 24_000, 10: 231_000, 100: 2_290_000, 1000: 28_000_000 }, expected: { unitPriceKamas: 22_900, lotSize: 100 } },
    { name: 'three lots, x1 cheaper than the others: x1 is not a quantity, the biggest is kept', ladder: { 1: 10_000, 10: 125_000, 100: 1_300_000 }, expected: { unitPriceKamas: 13_000, lotSize: 100 } },
    // Seen in game: x1 at 100 is within the factor 3 of the others (~270), so it is not set aside; it
    // used to win step 5 as the cheapest lot.
    { name: 'a cheap x1 under three lots that agree: the biggest lot', ladder: { 1: 100, 10: 2_680, 100: 26_989, 1000: 269_900 }, expected: { unitPriceKamas: 269.9, lotSize: 1000 } },
    { name: 'x1, x10 and x100 agree, x1000 dearer: x100', ladder: { 1: 200, 10: 2_000, 100: 20_000, 1000: 400_000 }, expected: { unitPriceKamas: 200, lotSize: 100 } },
    { name: 'x1000 cheaper than the lots that agree: x1000', ladder: { 1: 200, 10: 2_000, 100: 20_000, 1000: 180_000 }, expected: { unitPriceKamas: 180, lotSize: 1000 } },
    { name: 'no x1000, x100 cheaper than x1 and x10: x100', ladder: { 1: 200, 10: 2_000, 100: 18_000 }, expected: { unitPriceKamas: 180, lotSize: 100 } },
    { name: 'x1 cheap alone, x10 and x100 agree: x100', ladder: { 1: 100, 10: 2_000, 100: 20_000 }, expected: { unitPriceKamas: 200, lotSize: 100 } },
    { name: 'the two biggest lots dearer than the median: down to x10', ladder: { 1: 5_000, 10: 100_000, 100: 1_300_000, 1000: 14_000_000 }, expected: { unitPriceKamas: 10_000, lotSize: 10 } },
    { name: 'lots absent or at 0 are not on sale', ladder: { 1: 24_000, 10: 0, 1000: 22_000_000 }, expected: { unitPriceKamas: 22_000, lotSize: 1000 } },
    // 1, 10 and 100 kamas a unit: each is more than 3 times away from the median of the two others, so
    // everything is set aside and step 5 runs on every lot (step 6) — x1 sits out, the cheaper bulk lot wins.
    { name: 'everything set aside: step 5 on every lot (step 6)', ladder: { 1: 1, 10: 100, 100: 10_000 }, expected: { unitPriceKamas: 10, lotSize: 10 } },
  ];

  it.each(cases)('$name', ({ ladder, median, expected }) => {
    expect(unitPrice(ladder, median)).toEqual(expected);
  });
});
