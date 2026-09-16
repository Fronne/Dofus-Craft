import type { CommunityPrice } from '../domain/types';

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
): value is { resourceId: string; serverId: string; medianAmountKamas: number; sampleSize: number } {
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

// Sends only resourceId/serverId/amountKamas — never any player- or device-identifying data
// (FR-007). Returns undefined on any failure rather than throwing, matching getCommunityPrice.
export async function submitCommunityPrice(
  resourceId: string,
  serverId: string,
  amountKamas: number,
): Promise<{ id: string } | undefined> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/community-price`, {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ resourceId, serverId, amountKamas }),
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

// Knowing `id` is the only proof of ownership required (FR-012) — deleting an already-removed
// id still succeeds (the Worker's DELETE matching zero rows is not an error), so this is
// idempotent by construction. Resolves `false` (never throws) on a network/service failure so the
// caller can decide whether to keep retrying rather than losing track of the contribution.
export async function withdrawCommunityContribution(id: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/community-price/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: apiHeaders(),
    });
    return response.ok;
  } catch {
    return false;
  }
}
