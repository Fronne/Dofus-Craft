import { describe, expect, it } from 'vitest';
import { computeDeviationPercent } from '../../src/domain/outlier-threshold';

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
