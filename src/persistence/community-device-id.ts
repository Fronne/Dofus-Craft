import { createDeviceId } from './device-id';

const STORAGE_KEY = 'craftcheck-community-device-id';

// Anonymous, per-device identifier for community price contributions (specs/004-community-price-sharing
// revision 5, FR-021/FR-022).
export function getOrCreateDeviceId(): string {
  return createDeviceId(STORAGE_KEY);
}
