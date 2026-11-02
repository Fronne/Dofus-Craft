import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CALIBRATION_STORAGE_KEY, parseCalibration, readCalibration, writeCalibration } from '../../src/features/good-deals/deal-calibration';

// specs/080-bons-plans-filtre-calibrage (FR-013): what is kept in the browser, and what a bad save becomes.
describe('deal calibration', () => {
  beforeEach(() => window.localStorage.clear());

  it('keeps a calibration across a reload', () => {
    const calibration = { importance: { 124: 1 }, gaps: { 118: 10, 430: null }, thresholdPercent: 40 };
    writeCalibration(calibration);
    expect(readCalibration()).toEqual(calibration);
  });

  it('stores nothing for the defaults', () => {
    writeCalibration({ thresholdPercent: 40 });
    writeCalibration({});
    expect(window.localStorage.getItem(CALIBRATION_STORAGE_KEY)).toBeNull();
  });

  it('drops what it cannot read, value by value', () => {
    expect(parseCalibration(null)).toEqual({});
    expect(parseCalibration('not json')).toEqual({});
    expect(parseCalibration('[1]')).toEqual({});
    expect(parseCalibration(JSON.stringify({ importance: { 124: 1, 125: 7, x: 1 }, gaps: { 118: -1, 119: 2.5, 126: 3 }, thresholdPercent: 95 })))
      .toEqual({ importance: { 124: 1 }, gaps: { 126: 3 } });
  });

  it('survives a browser that refuses to store', () => {
    const refused = () => { throw new Error('denied'); };
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(refused);
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(refused);
    expect(readCalibration()).toEqual({});
    expect(() => writeCalibration({ thresholdPercent: 40 })).not.toThrow();
    get.mockRestore();
    set.mockRestore();
  });
});
