import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultBrisageSettings } from '../../src/domain/brisage';
import { getBrisageSettings, resetBrisageSettings, setBrisageSettings } from '../../src/persistence/brisage-settings';

// specs/060-page-brisage (FR-007): settings kept on the device, whatever the storage does.
const KEY = 'craftcheck-brisage-settings';

describe('brisage-settings', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('round-trips and resets', () => {
    const settings = { ...defaultBrisageSettings(), levelFactor: 0.02 };
    setBrisageSettings(settings);
    expect(getBrisageSettings().levelFactor).toBe(0.02);
    expect(resetBrisageSettings()).toEqual(defaultBrisageSettings());
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('falls back to the defaults on corrupted JSON', () => {
    window.localStorage.setItem(KEY, '{nope');
    expect(getBrisageSettings()).toEqual(defaultBrisageSettings());
  });

  it('never throws when the storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(getBrisageSettings()).toEqual(defaultBrisageSettings());
    expect(() => setBrisageSettings(defaultBrisageSettings())).not.toThrow();
    expect(resetBrisageSettings()).toEqual(defaultBrisageSettings());
  });
});
