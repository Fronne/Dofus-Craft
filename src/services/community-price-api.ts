import type { CommunityPrice } from '../domain/types';
import { getOrCreateDeviceId } from '../persistence/community-device-id';

const API_URL = import.meta.env.VITE_COMMUNITY_API_URL;
const API_KEY = import.meta.env.VITE_COMMUNITY_API_KEY;

function apiHeaders(extra?: Record<string, string>): HeadersInit {
  return {
    Authorization: `Bearer ${API_KEY}`,
    ...extra,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isCommunityPriceRow(
  value: unknown,
): value is { resourceId: string; serverId: string; medianAmountKamas: number; sampleSize: number; lastContributionAt?: string } {
  return isRecord(value) &&
    typeof value.resourceId === 'string' &&
    typeof value.serverId === 'string' &&
    typeof value.medianAmountKamas === 'number' &&
    typeof value.sampleSize === 'number';
}

export type CommunityPriceLookup =
  | { status: 'found'; price: CommunityPrice }
  | { status: 'not-found' }
  | { status: 'unavailable' };

// Never throws: a network error or an unreachable backend resolves to `{ status: 'unavailable' }`
// rather than an exception, so a failure here can never break the personal-price path around it
// (contracts/community-price-api.md, FR-009).
export async function getCommunityPrice(resourceId: string, serverId: string): Promise<CommunityPriceLookup> {
  const params = new URLSearchParams({ resourceId, serverId });
  let response: Response;
  try {
    response = await fetch(`${API_URL}/community-price?${params.toString()}`, { headers: apiHeaders() });
  } catch {
    return { status: 'unavailable' };
  }
  if (response.status === 404) return { status: 'not-found' };
  if (!response.ok) return { status: 'unavailable' };
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { status: 'unavailable' };
  }
  if (!isCommunityPriceRow(payload)) return { status: 'unavailable' };
  return { status: 'found', price: payload };
}

// Sends resourceId/serverId/amountKamas plus an anonymous per-device deviceId (specs/004-community-price-sharing
// revision 5, FR-010/FR-021/FR-022) — never any information identifying the player personally.
// Returns undefined on any failure rather than throwing, matching getCommunityPrice.
export async function submitCommunityPrice(
  resourceId: string,
  serverId: string,
  amountKamas: number,
): Promise<{ id: string } | undefined> {
  const deviceId = getOrCreateDeviceId();
  let response: Response;
  try {
    response = await fetch(`${API_URL}/community-price`, {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ resourceId, serverId, amountKamas, deviceId }),
    });
  } catch {
    return undefined;
  }
  if (!response.ok) return undefined;
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return undefined;
  }
  if (!isRecord(payload) || typeof payload.id !== 'string') return undefined;
  return { id: payload.id };
}
