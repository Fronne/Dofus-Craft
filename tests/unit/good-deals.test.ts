import { describe, expect, it } from 'vitest';
import { evaluateListings, jetQuality, MIN_NEIGHBOURS, selectGoodDeals, theoreticalRange, type DealVerdict, type Listing } from '../../src/domain/good-deals';

// specs/078-bons-plans-hdv (research R2–R4): the quality of a roll and the good-deal rule.
// Effect 125 = Vitalité (weight 0.2), 118 = Force, 178 = Soins. 999 is in no table.
const EFFECTS = [{ effectId: 125, from: 1, to: 60 }, { effectId: 118, from: 1, to: 30 }];

let counter = 0;
const listing = (price: number, vitality: number, extra: Listing['stats'] = []): Listing => {
  counter += 1;
  return { listingId: `L${counter}`, itemId: '1', priceKamas: price, stats: [{ effectId: 125, value: vitality }, ...extra] };
};

describe('jetQuality', () => {
  it('weights each line by the weight of its stat and counts the unknown ones', () => {
    const quality = jetQuality([{ effectId: 125, value: 50 }, { effectId: 999, value: 7 }], EFFECTS);
    expect(quality.quality).toBeCloseTo(50 * 0.2);
    expect(quality.unknownLines).toBe(1);
    expect(quality.exoEffectIds).toEqual([]);
  });

  it('counts an exo — a stat the item does not roll — for more than a normal line', () => {
    const normal = jetQuality([{ effectId: 118, value: 10 }], EFFECTS);
    const exo = jetQuality([{ effectId: 118, value: 10 }], [{ effectId: 125, from: 1, to: 60 }]);
    expect(exo.exoEffectIds).toEqual([118]);
    expect(exo.quality).toBeGreaterThan(normal.quality);
  });
});

describe('evaluateListings', () => {
  const market = [listing(1_000_000, 50), listing(1_020_000, 51), listing(980_000, 49), listing(1_010_000, 50)];

  it('marks a copy 30 % under comparable copies, with its saving', () => {
    const cheap = listing(700_000, 50);
    const verdict = evaluateListings([...market, cheap], EFFECTS, 25).find((v) => v.listingId === cheap.listingId)!;
    expect(verdict.isGoodDeal).toBe(true);
    expect(verdict.savingPercent).toBeGreaterThanOrEqual(25);
    expect(verdict.savingKamas).toBeGreaterThan(250_000);
    expect(verdict.neighbourCount).toBe(4);
  });

  it('does not mark a copy only 10 % cheaper', () => {
    const close = listing(900_000, 50);
    expect(evaluateListings([...market, close], EFFECTS, 25).find((v) => v.listingId === close.listingId)!.isGoodDeal).toBe(false);
  });

  it('marks a copy sitting exactly on the threshold', () => {
    const base = [listing(1_000_000, 50), listing(1_000_000, 50), listing(1_000_000, 50)];
    const edge = listing(750_000, 50);
    expect(evaluateListings([...base, edge], EFFECTS, 25).find((v) => v.listingId === edge.listingId)!.isGoodDeal).toBe(true);
  });

  it('marks a clearly better roll sold at the price of weaker ones', () => {
    const weak = [listing(1_000_000, 40), listing(1_000_000, 42), listing(1_000_000, 41), listing(1_000_000, 43)];
    const better = listing(1_000_000, 52);
    const verdict = evaluateListings([...weak, better], EFFECTS, 15).find((v) => v.listingId === better.listingId)!;
    expect(verdict.isGoodDeal).toBe(true);
  });

  it('does not judge a copy with fewer than the minimum of comparable copies', () => {
    expect(MIN_NEIGHBOURS).toBe(3);
    const lone = listing(100_000, 50);
    const verdicts = evaluateListings([lone, listing(1_000_000, 50), listing(1_000_000, 50)], EFFECTS, 25);
    expect(verdicts.find((v) => v.listingId === lone.listingId)!.isGoodDeal).toBe(false);
  });

  it('is not misled by one absurd price among the comparables', () => {
    const copy = listing(900_000, 50);
    const withTrap = [...market, listing(1, 50), copy];
    expect(evaluateListings(withTrap, EFFECTS, 25).find((v) => v.listingId === copy.listingId)!.isGoodDeal).toBe(false);
  });

  it('compares an exo copy only with copies carrying the same exo', () => {
    const exoStat = [{ effectId: 178, value: 5 }];
    const exoCopy = listing(500_000, 50, exoStat);
    const verdict = evaluateListings([...market, exoCopy], EFFECTS, 25).find((v) => v.listingId === exoCopy.listingId)!;
    expect(verdict.isGoodDeal).toBe(false);
    expect(verdict.neighbourCount).toBe(0);
    expect(verdict.hasExo).toBe(true);
  });

  it('answers an empty list with an empty list', () => {
    expect(evaluateListings([], EFFECTS, 25)).toEqual([]);
  });

  it('ignores a copy without any readable line', () => {
    const blank: Listing = { listingId: 'B', itemId: '1', priceKamas: 10, stats: [{ effectId: 999, value: 3 }] };
    expect(evaluateListings([blank, ...market], EFFECTS, 25).find((v) => v.listingId === 'B')!.isGoodDeal).toBe(false);
  });
});

describe('selectGoodDeals', () => {
  const deal = (id: string, savingKamas: number, savingPercent: number, extra: Partial<DealVerdict> = {}, stats: Listing['stats'] = [{ effectId: 125, value: 40 }]) =>
    ({ listingId: id, itemId: '1', priceKamas: 1000, savingKamas, savingPercent, neighbourCount: 3, isGoodDeal: true, hasExo: false, exoEffectIds: [], unknownLines: 0, quality: 8, listing: { listingId: id, itemId: '1', priceKamas: 1000, stats }, ...extra });

  it('keeps only the good deals, biggest saving first in the chosen unit', () => {
    const deals = [deal('a', 100, 40), deal('b', 300, 26), deal('c', 999, 90, { isGoodDeal: false })];
    expect(selectGoodDeals(deals, { sort: 'savingKamas', exoOnly: false }).map((d) => d.listingId)).toEqual(['b', 'a']);
    expect(selectGoodDeals(deals, { sort: 'savingPercent', exoOnly: false }).map((d) => d.listingId)).toEqual(['a', 'b']);
  });

  it('filters on exo and on a given stat', () => {
    const deals = [deal('a', 100, 40, { hasExo: true }), deal('b', 300, 26, {}, [{ effectId: 118, value: 10 }])];
    expect(selectGoodDeals(deals, { sort: 'savingKamas', exoOnly: true }).map((d) => d.listingId)).toEqual(['a']);
    expect(selectGoodDeals(deals, { sort: 'savingKamas', exoOnly: false, effectId: 118 }).map((d) => d.listingId)).toEqual(['b']);
  });

  it('answers nothing when nothing matches', () => {
    expect(selectGoodDeals([], { sort: 'savingKamas', exoOnly: true })).toEqual([]);
  });
});

describe('theoreticalRange', () => {
  it('gives the min and max of a normal stat', () => {
    expect(theoreticalRange(125, EFFECTS)).toBe('1 – 60');
  });
  it('gives nothing for an exo, which the item cannot roll', () => {
    expect(theoreticalRange(178, EFFECTS)).toBeUndefined();
  });
  it('shows a fixed stat once and ignores the order of the bounds', () => {
    expect(theoreticalRange(1, [{ effectId: 1, from: 50, to: 50 }])).toBe('50');
    expect(theoreticalRange(1, [{ effectId: 1, from: 8 }])).toBe('8');
    expect(theoreticalRange(1, [{ effectId: 1, from: -5, to: -20 }])).toBe('-20 – -5');
  });
  it('gives nothing when the bounds are unknown', () => {
    expect(theoreticalRange(1, [{ effectId: 1 }])).toBeUndefined();
  });
});
