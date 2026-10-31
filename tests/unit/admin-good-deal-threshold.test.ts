import { beforeEach, describe, expect, it } from 'vitest';
import { getThreshold, saveThreshold, validateThreshold } from '../../admin-worker/src/good-deal-threshold';
import { createTestD1 } from '../support/sqlite-d1';

// specs/078-bons-plans-hdv (US4): the threshold the owner sets in the administration.
let test: ReturnType<typeof createTestD1>;

beforeEach(() => {
  test = createTestD1();
});

describe('validateThreshold', () => {
  it.each([5, 25, 40, 90])('accepts %i', (value) => {
    expect(validateThreshold({ thresholdPercent: value })).toEqual({ ok: true, value });
  });

  it.each([[4], [91], [0], [-3], [12.5], ['25'], [null], [undefined]])('refuses %j', (value) => {
    expect(validateThreshold({ thresholdPercent: value })).toMatchObject({ ok: false, field: 'thresholdPercent' });
  });

  it('refuses a body that is not an object', () => {
    expect(validateThreshold(undefined)).toMatchObject({ ok: false });
    expect(validateThreshold('25')).toMatchObject({ ok: false });
  });
});

describe('saving the threshold', () => {
  it('is 25 until saved, then answers with the value read back', async () => {
    expect(await getThreshold(test.d1)).toEqual({ thresholdPercent: 25 });
    expect(await saveThreshold(test.d1, 40)).toEqual({ thresholdPercent: 40 });
    expect(await getThreshold(test.d1)).toEqual({ thresholdPercent: 40 });
  });

  it('replaces the previous value instead of adding a row', async () => {
    await saveThreshold(test.d1, 40);
    await saveThreshold(test.d1, 30);
    expect(test.sqlite.prepare('SELECT COUNT(*) AS n FROM numeric_settings').get()).toEqual({ n: 1 });
    expect(await getThreshold(test.d1)).toEqual({ thresholdPercent: 30 });
  });
});
