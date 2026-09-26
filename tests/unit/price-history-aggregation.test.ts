import { describe, expect, it } from 'vitest';
import { computePriceHistory } from '../../worker/src/price-history';
import type { ContributionRow } from '../../worker/src/median';

// specs/017-price-history-chart (contracts/price-history-api.md, research.md §3). Paris is UTC+2
// until 2026-10-25 03:00 (CEST), UTC+1 after (CET).
const NOW = new Date('2026-09-25T12:00:00.000Z');

function row(amountKamas: number, createdAt: string, deviceId = 'device-a'): ContributionRow {
  return { amountKamas, createdAt, deviceId };
}

describe('computePriceHistory (specs/017)', () => {
  it('returns three empty groupings without any row', () => {
    expect(computePriceHistory([], NOW)).toEqual({ day: [], week: [], month: [] });
  });

  it('splits 23:30 and 00:30 Paris time into two days, even on the same UTC day', () => {
    const history = computePriceHistory([
      row(1000, '2026-09-14T21:30:00.000Z', 'a'), // 23:30 Paris, 14 Sept.
      row(2000, '2026-09-14T22:30:00.000Z', 'b'), // 00:30 Paris, 15 Sept.
    ], NOW);
    expect(history.day).toEqual([
      { periodStart: '2026-09-14', medianAmountKamas: 1000, sampleSize: 1 },
      { periodStart: '2026-09-15', medianAmountKamas: 2000, sampleSize: 1 },
    ]);
  });

  it('puts a Sunday and the next Monday in two weeks, each identified by its Monday', () => {
    const history = computePriceHistory([
      row(1000, '2026-09-20T12:00:00.000Z', 'a'), // Sunday
      row(2000, '2026-09-21T12:00:00.000Z', 'b'), // Monday
    ], NOW);
    expect(history.week.map((point) => point.periodStart)).toEqual(['2026-09-14', '2026-09-21']);
  });

  it('puts the 31st and the 1st in two months, identified by their first day, in Paris time', () => {
    const history = computePriceHistory([
      row(1000, '2026-08-31T12:00:00.000Z', 'a'),
      row(2000, '2026-08-31T22:30:00.000Z', 'b'), // 00:30 Paris, 1 Sept.
    ], NOW);
    expect(history.month).toEqual([
      { periodStart: '2026-08-01', medianAmountKamas: 1000, sampleSize: 1 },
      { periodStart: '2026-09-01', medianAmountKamas: 2000, sampleSize: 1 },
    ]);
  });

  it('keeps the right Paris date across the October daylight-saving change', () => {
    const history = computePriceHistory([
      row(1000, '2026-10-24T22:30:00.000Z', 'a'), // 00:30 CEST, 25 Oct.
      row(2000, '2026-10-25T23:30:00.000Z', 'b'), // 00:30 CET, 26 Oct.
    ], new Date('2026-11-01T12:00:00.000Z'));
    expect(history.day.map((point) => point.periodStart)).toEqual(['2026-10-25', '2026-10-26']);
    // 25 Oct. is a Sunday: the week of 19 Oct.; 26 Oct. starts the next one.
    expect(history.week.map((point) => point.periodStart)).toEqual(['2026-10-19', '2026-10-26']);
  });

  it('counts every price a device shared in the day', () => {
    const history = computePriceHistory([
      row(1000, '2026-09-21T08:00:00.000Z'),
      row(1100, '2026-09-21T09:00:00.000Z'),
      row(1300, '2026-09-21T10:00:00.000Z'),
    ], NOW);
    expect(history.day).toEqual([{ periodStart: '2026-09-21', medianAmountKamas: 1100, sampleSize: 3 }]);
  });

  it('counts a device in each day it shared a price', () => {
    const history = computePriceHistory([
      row(1000, '2026-09-21T08:00:00.000Z'),
      row(1200, '2026-09-22T08:00:00.000Z'),
    ], NOW);
    expect(history.day).toEqual([
      { periodStart: '2026-09-21', medianAmountKamas: 1000, sampleSize: 1 },
      { periodStart: '2026-09-22', medianAmountKamas: 1200, sampleSize: 1 },
    ]);
    // Same week: both prices count.
    expect(history.week).toEqual([{ periodStart: '2026-09-21', medianAmountKamas: 1100, sampleSize: 2 }]);
  });

  it('counts each row without a device id on its own', () => {
    const history = computePriceHistory([
      row(1000, '2026-09-21T08:00:00.000Z', ''),
      row(1500, '2026-09-21T09:00:00.000Z', ''),
    ], NOW);
    expect(history.day).toEqual([{ periodStart: '2026-09-21', medianAmountKamas: 1250, sampleSize: 2 }]);
  });

  it('drops an aberrant value, which counts in no sample size, and the period it was alone in', () => {
    const history = computePriceHistory([
      row(1000, '2026-09-21T08:00:00.000Z', 'a'),
      row(1000, '2026-09-21T08:00:00.000Z', 'b'),
      row(1100, '2026-09-21T08:00:00.000Z', 'c'),
      row(1200, '2026-09-21T08:00:00.000Z', 'd'),
      row(90000, '2026-09-22T08:00:00.000Z', 'e'),
    ], NOW);
    expect(history.day).toEqual([{ periodStart: '2026-09-21', medianAmountKamas: 1050, sampleSize: 4 }]);
    expect(history.week).toEqual([{ periodStart: '2026-09-21', medianAmountKamas: 1050, sampleSize: 4 }]);
  });

  it('ignores a row older than 90 days', () => {
    const history = computePriceHistory([
      row(1000, '2026-06-01T12:00:00.000Z', 'a'),
      row(2000, '2026-09-21T12:00:00.000Z', 'b'),
    ], NOW);
    expect(history.day).toEqual([{ periodStart: '2026-09-21', medianAmountKamas: 2000, sampleSize: 1 }]);
  });

  it('interpolates the median (1000 and 1500 give 1250)', () => {
    const history = computePriceHistory([
      row(1000, '2026-09-21T08:00:00.000Z', 'a'),
      row(1500, '2026-09-21T09:00:00.000Z', 'b'),
    ], NOW);
    expect(history.day[0].medianAmountKamas).toBe(1250);
  });

  it('sorts points by ascending period, whatever the row order', () => {
    const history = computePriceHistory([
      row(3000, '2026-09-23T08:00:00.000Z', 'a'),
      row(1000, '2026-09-01T08:00:00.000Z', 'b'),
      row(2000, '2026-09-10T08:00:00.000Z', 'c'),
    ], NOW);
    expect(history.day.map((point) => point.periodStart)).toEqual(['2026-09-01', '2026-09-10', '2026-09-23']);
  });

  it('builds a point for the current, unfinished period like any other', () => {
    const history = computePriceHistory([row(1000, '2026-09-25T09:00:00.000Z')], NOW);
    expect(history.day).toEqual([{ periodStart: '2026-09-25', medianAmountKamas: 1000, sampleSize: 1 }]);
    expect(history.month).toEqual([{ periodStart: '2026-09-01', medianAmountKamas: 1000, sampleSize: 1 }]);
  });
});
