import { describe, expect, it } from 'vitest';
import { describeJetLine, evaluateListings, jetCardLines, jetQuality, MIN_NEIGHBOURS, selectGoodDeals, theoreticalRange, type DealVerdict, type Listing } from '../../src/domain/good-deals';

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
    // Bounds unknown: no defect, so the weaker rolls stay comparable to the better one.
    const weak = [listing(1_000_000, 40), listing(1_000_000, 42), listing(1_000_000, 41), listing(1_000_000, 43)];
    const better = listing(1_000_000, 52);
    const verdict = evaluateListings([...weak, better], [{ effectId: 125 }], 15).find((v) => v.listingId === better.listingId)!;
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
    expect(theoreticalRange(125, EFFECTS)).toBe('1 à 60');
  });
  it('gives nothing for an exo, which the item cannot roll', () => {
    expect(theoreticalRange(178, EFFECTS)).toBeUndefined();
  });
  it('shows a fixed stat once and ignores the order of the bounds', () => {
    expect(theoreticalRange(1, [{ effectId: 1, from: 50, to: 50 }])).toBe('50');
    expect(theoreticalRange(1, [{ effectId: 1, from: 8 }])).toBe('8');
    expect(theoreticalRange(1, [{ effectId: 1, from: -5, to: -20 }])).toBe('-20 à -5');
  });
  it('gives nothing when the bounds are unknown', () => {
    expect(theoreticalRange(1, [{ effectId: 1 }])).toBeUndefined();
  });
});

// specs/079-calcul-bons-plans: a Force line big enough for the exo to stay within the quality range.
describe('exo tiers', () => {
  const STRONG = [{ effectId: 118, from: 1, to: 500 }];
  const copyWith = (effectId: number, value: number): Listing => {
    counter += 1;
    return { listingId: `T${counter}`, itemId: '1', priceKamas: 1_000_000, stats: [{ effectId: 118, value: 500 }, { effectId, value }] };
  };
  const neighbours = (effectId: number, value: number, others: number) => {
    const judged = copyWith(effectId, value);
    const copies = [judged, ...[1, 2, 3].map(() => copyWith(effectId, others))];
    return evaluateListings(copies, STRONG, 25).find((v) => v.listingId === judged.listingId)!.neighbourCount;
  };

  it('keeps apart two exos on each side of 30 weight, for any stat', () => {
    expect(neighbours(2812, 1, 2)).toBe(0); // Dommages aux sorts: 15, 30
    expect(neighbours(115, 2, 3)).toBe(0); // Critique: 20, 30
    expect(neighbours(124, 9, 10)).toBe(0); // Sagesse: 27, 30
  });

  it('compares two exos on the same side', () => {
    expect(neighbours(2812, 2, 3)).toBe(3);
    expect(neighbours(115, 1, 2)).toBe(3);
  });
});

describe('defects', () => {
  const defects = (effectId: number, max: number, value: number) =>
    jetQuality([{ effectId, value }], [{ effectId, from: 1, to: max }]).defectEffectIds;

  it('accepts 5 under the max on the main characteristics and Dommages Neutre', () => {
    for (const effectId of [118, 126, 123, 119, 138, 430]) {
      expect(defects(effectId, 100, 95)).toEqual([]);
      expect(defects(effectId, 100, 94)).toEqual([effectId]);
    }
  });

  it('accepts 1 under the max on the other damages and the % resistances', () => {
    for (const effectId of [112, 422, 2812, 210, 2803]) {
      expect(defects(effectId, 20, 19)).toEqual([]);
      expect(defects(effectId, 20, 18)).toEqual([effectId]);
    }
  });

  it('accepts nothing under the max on Critique, PA, PM, Portée, Invocations', () => {
    for (const effectId of [115, 111, 128, 117, 182]) {
      expect(defects(effectId, 10, 10)).toEqual([]);
      expect(defects(effectId, 10, 9)).toEqual([effectId]);
    }
  });

  it('accepts 2 on Dommages Critiques only when the max is above 20', () => {
    expect(defects(418, 20, 18)).toEqual([418]);
    expect(defects(418, 20, 19)).toEqual([]);
    expect(defects(418, 21, 19)).toEqual([]);
    expect(defects(418, 21, 18)).toEqual([418]);
  });

  it('scales the Vitalité gap with the max, 12 at least', () => {
    expect(defects(125, 100, 88)).toEqual([]);
    expect(defects(125, 100, 87)).toEqual([125]);
    expect(defects(125, 400, 370)).toEqual([]);
    expect(defects(125, 400, 369)).toEqual([125]);
  });

  it('never counts a defect on Dommages Poussée, Sagesse or a stat over its max', () => {
    expect(defects(414, 100, 1)).toEqual([]);
    expect(defects(124, 100, 1)).toEqual([]);
    expect(defects(118, 100, 110)).toEqual([]);
  });

  it('counts a missing line as 0, and invents nothing from unknown bounds', () => {
    expect(jetQuality([], [{ effectId: 111, from: 1, to: 1 }]).defectEffectIds).toEqual([111]);
    expect(jetQuality([], [{ effectId: 118 }]).defectEffectIds).toEqual([]);
  });

  it('only compares copies with the same defects', () => {
    const effects = [{ effectId: 118, from: 1, to: 100 }, { effectId: 126, from: 1, to: 100 }];
    const copy = (force: number, intelligence: number): Listing => {
      counter += 1;
      return { listingId: `D${counter}`, itemId: '1', priceKamas: 1_000_000, stats: [{ effectId: 118, value: force }, { effectId: 126, value: intelligence }] };
    };
    const judged = copy(80, 100);
    const others = [copy(100, 80), copy(100, 80), copy(100, 80)];
    expect(evaluateListings([judged, ...others], effects, 25).find((v) => v.listingId === judged.listingId)!.neighbourCount).toBe(0);
    const same = [copy(79, 100), copy(80, 99), copy(81, 100)];
    expect(evaluateListings([judged, ...same], effects, 25).find((v) => v.listingId === judged.listingId)!.neighbourCount).toBe(3);
  });
});

describe('stat importance', () => {
  const line = (effectId: number, value: number) => jetQuality([{ effectId, value }], [{ effectId, from: 1, to: value }]).quality;

  it('scales the brisage weight by the importance of the stat', () => {
    expect(line(111, 1)).toBeCloseTo(100 * 1.5); // PA
    expect(line(118, 10)).toBeCloseTo(10); // Force
    expect(line(752, 10)).toBeCloseTo(10 * 4 * 0.5); // Fuite
    expect(line(414, 10)).toBeCloseTo(10 * 5 * 0.5); // Dommages Poussée
    expect(line(124, 40)).toBeCloseTo(40 * 3 * 0.25); // Sagesse
    expect(line(240, 10)).toBeCloseTo(10 * 2 * 0.25); // Résistances Terre
  });

  it('counts nothing for a stat of no importance', () => {
    for (const effectId of [220, 225, 226, 795]) expect(line(effectId, 10)).toBe(0);
  });

  it('adds the exo factor to the importance, and leaves the tier on the brisage weight', () => {
    const exo = jetQuality([{ effectId: 124, value: 10 }], []);
    expect(exo.quality).toBeCloseTo(10 * 3 * 1.5 * 0.25);
    expect(exo.exoTiers).toEqual(['124:high']);
  });
});

describe('describeJetLine', () => {
  it('reads a normal line with its value and label', () => {
    expect(describeJetLine({ effectId: 125, value: 245 })).toEqual({ text: '245 Vitalité', iconEffectId: 125, isMalus: false });
  });

  it('shows a malus with a minus sign, on the stat it lowers', () => {
    expect(describeJetLine({ effectId: 116, value: 1 })).toEqual({ text: '−1 Portée', iconEffectId: 117, isMalus: true });
    expect(describeJetLine({ effectId: 755, value: 30 })).toEqual({ text: '−30 Tacle', iconEffectId: 753, isMalus: true });
  });

  it('names the forgemagie lock without its value', () => {
    expect(describeJetLine({ effectId: 2825, value: 0 }).text).toBe('Empêche les futures forgemagies');
  });

  it('falls back on the effect id for an unknown effect', () => {
    expect(describeJetLine({ effectId: 999, value: 7 }).text).toBe('7 Effet 999');
  });
});

describe('jetCardLines', () => {
  const ITEM = [{ effectId: 125, from: 251, to: 300 }, { effectId: 115, from: 2, to: 3 }, { effectId: 117, from: 1, to: 1 }];
  const lines = jetCardLines(
    [{ effectId: 755, value: 30 }, { effectId: 2825, value: 0 }, { effectId: 178, value: 5 }, { effectId: 115, value: 3 }, { effectId: 125, value: 280 }],
    ITEM,
  );

  it('follows the item, then the exos, the maluses and the rest', () => {
    expect(lines.map((line) => line.effectId)).toEqual([125, 115, 117, 178, 755, 2825]);
    expect(lines.map((line) => line.tone)).toEqual(['normal', 'normal', 'muted', 'exo', 'malus', 'muted']);
  });

  it('reads like the game, with the theoretical roll on the rolled lines only', () => {
    expect(lines[0]).toMatchObject({ text: '280 Vitalité', range: '251 à 300' });
    expect(lines[1]).toMatchObject({ text: '3% Critique', range: '2 à 3' });
    expect(lines[2]).toMatchObject({ text: '0 Portée', range: '1' });
    expect(lines[3].range).toBeUndefined();
    expect(lines[4].text).toBe('−30 Tacle');
    expect(lines[4].range).toBeUndefined();
  });

  it('keeps the percent on a malus', () => {
    expect(describeJetLine({ effectId: 171, value: 5 }).text).toBe('−5% Critique');
  });

  it('keeps an announcement line even when the item effect has no known stat', () => {
    expect(jetCardLines([{ effectId: 999, value: 4 }], [{ effectId: 999, from: 1, to: 5 }]).map((line) => line.text)).toEqual(['4 Effet 999']);
  });

  it('leaves out an item effect with no known stat', () => {
    expect(jetCardLines([], [{ effectId: 999, from: 1, to: 2 }])).toEqual([]);
  });
});
