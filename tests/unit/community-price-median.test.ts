import { describe, expect, it } from 'vitest';
import { computeCommunityMedian } from '../../worker/src/median';

describe('computeCommunityMedian (Cloudflare Worker, specs/004-community-price-sharing)', () => {
  it('is undefined for no contributions', () => {
    expect(computeCommunityMedian([])).toBeUndefined();
  });

  it('returns the single value as the median for one contribution (Edge Cases, spec.md)', () => {
    expect(computeCommunityMedian([1000])).toEqual({ medianAmountKamas: 1000, sampleSize: 1 });
  });

  it('computes the median via linear interpolation, matching PostgreSQL percentile_cont', () => {
    expect(computeCommunityMedian([1000, 2000, 3000])).toEqual({ medianAmountKamas: 2000, sampleSize: 3 });
    expect(computeCommunityMedian([1000, 2000, 3000, 4000])).toEqual({ medianAmountKamas: 2500, sampleSize: 4 });
  });

  it('excludes a statistically aberrant value before computing the median (FR-010)', () => {
    const result = computeCommunityMedian([980, 1000, 1020, 1010, 1000000]);
    expect(result?.medianAmountKamas).toBeLessThan(2000);
    expect(result?.sampleSize).toBe(4);
  });

  it('does not exclude anything with too few points for a meaningful IQR', () => {
    const result = computeCommunityMedian([100, 100000]);
    expect(result?.sampleSize).toBe(2);
  });
});
