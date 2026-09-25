import { describe, expect, it } from 'vitest';
import { computeDeviationPercent, ITEM_OUTLIER_THRESHOLD_PERCENT, needsItemPriceConfirmation } from '../../src/domain/outlier-threshold';

describe('computeDeviationPercent (specs/007-outlier-confirmation)', () => {
  it('is 30 for a value 30% above the median', () => {
    expect(computeDeviationPercent(1300, 1000)).toBe(30);
  });

  it('is 0 when the entered value equals the median', () => {
    expect(computeDeviationPercent(1000, 1000)).toBe(0);
  });

  it('is symmetric: a value below the median deviates the same as one above it', () => {
    expect(computeDeviationPercent(700, 1000)).toBe(30);
  });

  it('is exactly 25 at the threshold boundary, with no rounding or thresholding applied here', () => {
    expect(computeDeviationPercent(1250, 1000)).toBe(25);
  });
});

describe('needsItemPriceConfirmation (specs/016 FR-006/FR-008)', () => {
  it('uses a 50 % threshold against the latest price shown', () => {
    expect(ITEM_OUTLIER_THRESHOLD_PERCENT).toBe(50);
    expect(needsItemPriceConfirmation(14_900, 10_000)).toBe(false); // 49 %
    expect(needsItemPriceConfirmation(15_000, 10_000)).toBe(false); // 50 %: only strictly above
    expect(needsItemPriceConfirmation(15_100, 10_000)).toBe(true); // 51 %
    expect(needsItemPriceConfirmation(4_900, 10_000)).toBe(true); // -51 %
    expect(needsItemPriceConfirmation(100_000, 10_000)).toBe(true); // a zero too many
  });

  it('never asks without a latest price, and always when the latest was 0 and the new one is not', () => {
    expect(needsItemPriceConfirmation(7_000, undefined)).toBe(false);
    expect(needsItemPriceConfirmation(7_000, 0)).toBe(true);
    expect(needsItemPriceConfirmation(0, 0)).toBe(false);
  });
});
