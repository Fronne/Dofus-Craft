import { getOrCreateDeviceId } from '../../persistence/community-device-id';
import { readFmSessionToken } from '../../persistence/fm-session-token';
import { API_URL, apiHeaders, isRecord, markFreshReads } from './http';

// Sends resourceId/serverId/amountKamas plus an anonymous per-device deviceId (specs/004-community-price-sharing
// revision 5, FR-010/FR-021/FR-022) — never any information identifying the player personally.
// Returns undefined on any failure rather than throwing, matching getCommunityPrice.
export async function submitCommunityPrice(
  resourceId: string,
  serverId: string,
  amountKamas: number,
  // specs/016: 'item' for an item's HDV price (stored and outlier-traced as such); omitted for a
  // resource price, so resource contributions are sent exactly as before.
  kind?: 'item',
): Promise<{ id: string } | undefined> {
  const deviceId = getOrCreateDeviceId();
  // specs/082-auteur-prix-communautaires: a logged-in player signs the price; without a session it stays anonymous.
  const session = readFmSessionToken();
  let response: Response;
  try {
    response = await fetch(`${API_URL}/community-price`, {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json', ...(session ? { 'X-Fm-Session': session } : {}) }),
      body: JSON.stringify(kind ? { resourceId, serverId, amountKamas, deviceId, kind } : { resourceId, serverId, amountKamas, deviceId }),
      // specs/052-direct-price-entry: a price typed just before the page unloads is still sent.
      keepalive: true,
    });
  } catch {
    return undefined;
  }
  if (!response.ok) return undefined;
  markFreshReads();
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return undefined;
  }
  if (!isRecord(payload) || typeof payload.id !== 'string') return undefined;
  return { id: payload.id };
}
