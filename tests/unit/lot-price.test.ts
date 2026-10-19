import { describe, expect, it } from 'vitest';
import { pickLotPrice, type LotUnitPrices } from '../../src/domain/lot-price';

// specs/058-prix-par-lot: the biggest lot not above the quantity that has a price, else a smaller one.
const all: LotUnitPrices = { 1: { unitPriceKamas: 100 }, 10: { unitPriceKamas: 90 }, 100: { unitPriceKamas: 80 }, 1000: { unitPriceKamas: 70 } };

describe('pickLotPrice', () => {
  it.each([
    [250, 100],
    [5, 1],
    [1, 1],
    [9, 1],
    [10, 10],
    [99, 10],
    [100, 100],
    [999, 100],
    [1000, 1000],
    [50_000, 1000],
  ])('takes the lot of %i units from the biggest lot that fits: %i', (quantity, lotSize) => {
    expect(pickLotPrice(quantity, all)?.lotSize).toBe(lotSize);
  });

  it('gives the unit price and date of that lot', () => {
    expect(pickLotPrice(250, { ...all, 100: { unitPriceKamas: 80, date: '2026-10-19T10:00:00Z' } })).toEqual({ lotSize: 100, unitPriceKamas: 80, date: '2026-10-19T10:00:00Z' });
  });

  it('goes down to a smaller lot when the one that fits has no price', () => {
    expect(pickLotPrice(250, { 1: { unitPriceKamas: 100 }, 10: { unitPriceKamas: 90 } })?.lotSize).toBe(10);
    expect(pickLotPrice(5000, { 1: { unitPriceKamas: 100 }, 100: { unitPriceKamas: 0 } })?.lotSize).toBe(1);
  });

  it('never takes a lot bigger than the quantity', () => {
    expect(pickLotPrice(5, { 10: { unitPriceKamas: 90 }, 1000: { unitPriceKamas: 70 } })).toBeUndefined();
    expect(pickLotPrice(999, { 1000: { unitPriceKamas: 70 } })).toBeUndefined();
  });

  it('is undefined when no lot has a price', () => {
    expect(pickLotPrice(250, {})).toBeUndefined();
  });
});
