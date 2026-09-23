import { describe, expect, it } from 'vitest';
import { latestPerDevice, summarizeContributions } from '../../worker/src/median';

const row = (amountKamas: number, createdAt: string, deviceId: string) => ({ amountKamas, createdAt, deviceId });

describe('latestPerDevice (specs/004-community-price-sharing FR-023, révision 7)', () => {
  it('keeps only the latest contribution of each device', () => {
    const kept = latestPerDevice([
      row(100, '2026-09-20T10:00:00Z', 'a'),
      row(300, '2026-09-22T10:00:00Z', 'a'),
      row(200, '2026-09-21T10:00:00Z', 'a'),
      row(150, '2026-09-21T10:00:00Z', 'b'),
    ]);
    expect(kept.map((item) => item.amountKamas).sort()).toEqual([150, 300]);
  });

  it('counts each contribution without a device id on its own', () => {
    expect(latestPerDevice([row(100, '2026-09-20T10:00:00Z', ''), row(120, '2026-09-21T10:00:00Z', '')])).toHaveLength(2);
  });
});

describe('summarizeContributions', () => {
  it('is undefined without contributions', () => {
    expect(summarizeContributions([])).toBeUndefined();
  });

  it('counts a device that corrected its price once, with its latest value', () => {
    expect(summarizeContributions([
      row(1000, '2026-09-20T10:00:00Z', 'a'),
      row(2000, '2026-09-21T10:00:00Z', 'a'),
      row(2000, '2026-09-21T11:00:00Z', 'b'),
    ])).toEqual({ medianAmountKamas: 2000, sampleSize: 2, lastContributionAt: '2026-09-21T11:00:00Z' });
  });

  it('never dates the price from a contribution excluded as aberrant', () => {
    const result = summarizeContributions([
      row(980, '2026-09-20T10:00:00Z', 'a'),
      row(1000, '2026-09-20T11:00:00Z', 'b'),
      row(1020, '2026-09-20T12:00:00Z', 'c'),
      row(1010, '2026-09-20T13:00:00Z', 'd'),
      row(1000000, '2026-09-23T10:00:00Z', 'e'),
    ]);
    expect(result?.sampleSize).toBe(4);
    expect(result?.lastContributionAt).toBe('2026-09-20T13:00:00Z');
  });
});
