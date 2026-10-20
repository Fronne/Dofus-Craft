import { describe, expect, it } from 'vitest';
import { resolveItemPrice } from '../../src/domain/brisage-price';

// specs/065-refonte-page-brisage: the price of the item is the buying price, the craft cost, or the cheaper of the two.
describe('resolveItemPrice', () => {
  it('takes the buying price for Achat and the craft cost for Craft', () => {
    expect(resolveItemPrice(1000, 800, 'hdv')).toEqual({ kamas: 1000, origin: 'hdv' });
    expect(resolveItemPrice(1000, 800, 'craft')).toEqual({ kamas: 800, origin: 'craft' });
  });

  it('takes the cheaper of the two for Auto, and says where it comes from', () => {
    expect(resolveItemPrice(1000, 800, 'auto')).toEqual({ kamas: 800, origin: 'craft' });
    expect(resolveItemPrice(500, 800, 'auto')).toEqual({ kamas: 500, origin: 'hdv' });
  });

  it('prefers the buying price when both are equal', () => {
    expect(resolveItemPrice(700, 700, 'auto')).toEqual({ kamas: 700, origin: 'hdv' });
  });

  it('falls back on the only known price for Auto', () => {
    expect(resolveItemPrice(undefined, 800, 'auto')).toEqual({ kamas: 800, origin: 'craft' });
    expect(resolveItemPrice(1000, undefined, 'auto')).toEqual({ kamas: 1000, origin: 'hdv' });
  });

  it('gives nothing, never 0, when the chosen price is unknown', () => {
    expect(resolveItemPrice(undefined, 800, 'hdv')).toBeUndefined();
    expect(resolveItemPrice(1000, undefined, 'craft')).toBeUndefined();
    expect(resolveItemPrice(undefined, undefined, 'auto')).toBeUndefined();
  });

  it('treats a zero, negative or NaN price as unknown', () => {
    expect(resolveItemPrice(0, 800, 'auto')).toEqual({ kamas: 800, origin: 'craft' });
    expect(resolveItemPrice(-5, NaN, 'auto')).toBeUndefined();
    expect(resolveItemPrice(0, 0, 'hdv')).toBeUndefined();
  });
});
