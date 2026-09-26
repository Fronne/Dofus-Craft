import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dismissVersion, readDismissedVersion } from '../../src/persistence/info-banner-dismissal';

// specs/020-info-banner FR-004.
describe('info banner dismissal (specs/020)', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('remembers the closed version', () => {
    expect(readDismissedVersion()).toBeUndefined();
    dismissVersion('2026-09-26T10:00:00.000Z');
    expect(readDismissedVersion()).toBe('2026-09-26T10:00:00.000Z');
  });

  it('never throws when localStorage does', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => dismissVersion('v')).not.toThrow();
    expect(readDismissedVersion()).toBeUndefined();
  });
});
