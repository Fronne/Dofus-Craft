import { describe, expect, it } from 'vitest';
import { classifyPriceAge } from '../../src/domain/price-age';

const now = new Date('2026-09-21T12:00:00Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

describe('classifyPriceAge (specs/008-stale-resource-highlight)', () => {
  it('is unknown when updatedAt is absent', () => {
    expect(classifyPriceAge(undefined, now)).toBe('unknown');
  });

  it('is fresh just under the 3-day threshold', () => {
    expect(classifyPriceAge(daysAgo(2.99), now)).toBe('fresh');
  });

  it('is stale exactly at the 3-day threshold', () => {
    expect(classifyPriceAge(daysAgo(3), now)).toBe('stale');
  });

  it('is stale just under the 7-day threshold', () => {
    expect(classifyPriceAge(daysAgo(6.99), now)).toBe('stale');
  });

  it('is expired exactly at the 7-day threshold', () => {
    expect(classifyPriceAge(daysAgo(7), now)).toBe('expired');
  });

  it('is expired well past the 7-day threshold', () => {
    expect(classifyPriceAge(daysAgo(10), now)).toBe('expired');
  });
});
