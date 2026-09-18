import { createDeviceId } from './device-id';

const STORAGE_KEY = 'craftcheck-visit-device-id';

// Anonymous, per-device identifier for the daily presence signal (specs/006-anonymous-visit-count,
// FR-002) — intentionally distinct from the community price contribution device id (specs/004
// revision 5): neither value is ever derived from, or linkable to, the other.
export function getOrCreateVisitDeviceId(): string {
  return createDeviceId(STORAGE_KEY);
}
