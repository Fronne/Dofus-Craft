import { beforeEach, describe, expect, it } from 'vitest';
import { getOrCreateVisitDeviceId } from '../../src/persistence/visit-device-id';
import { getOrCreateDeviceId } from '../../src/persistence/community-device-id';

describe('visit device id (specs/006-anonymous-visit-count)', () => {
  beforeEach(() => window.localStorage.clear());

  it('generates and persists a new id under its own storage key', () => {
    const id = getOrCreateVisitDeviceId();
    expect(id).toBeTruthy();
    expect(window.localStorage.getItem('craftcheck-visit-device-id')).toBe(id);
  });

  it('stays independent from the community price contribution device id', () => {
    const communityId = getOrCreateDeviceId();
    const visitId = getOrCreateVisitDeviceId();
    expect(visitId).not.toBe(communityId);
    expect(window.localStorage.getItem('craftcheck-community-device-id')).toBe(communityId);
    expect(window.localStorage.getItem('craftcheck-visit-device-id')).toBe(visitId);
  });
});
