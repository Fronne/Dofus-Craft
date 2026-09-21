import { describe, expect, it } from 'vitest';
import { computeDeviationPercent, resolveOutlierFields } from '../../worker/src/outlier';

describe('outlier tracking (Cloudflare Worker, specs/007-outlier-confirmation)', () => {
  it('computeDeviationPercent matches the client-side formula', () => {
    expect(computeDeviationPercent(1300, 1000)).toBe(30);
  });

  it('resolveOutlierFields returns the median and deviation when a prior median exists', () => {
    expect(resolveOutlierFields(1300, { medianAmountKamas: 1000 })).toEqual({
      medianAtSubmissionKamas: 1000,
      deviationPercent: 30,
    });
  });

  it('resolveOutlierFields returns null fields when no prior median exists (FR-008)', () => {
    expect(resolveOutlierFields(1300, undefined)).toEqual({
      medianAtSubmissionKamas: null,
      deviationPercent: null,
    });
  });
});
