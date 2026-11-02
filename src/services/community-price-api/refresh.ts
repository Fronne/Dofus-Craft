import type { RefreshOutcome } from '../../domain/huzounet-load';
import type { RecipeRefreshOutcome } from '../../domain/recipe-refresh';
import { API_URL, apiHeaders, isRecord, markFreshReads } from './http';

// specs/046-hdv-huzounet-load (contracts/external-prices-refresh.md): asks the API to read again, on
// Huzounet, the prices of up to 90 items of a server, as one request of an HDV tab's load (the API lets
// a tab be loaded once an hour). Never throws. Once prices were read, the next
// reads are fresh ones, like after this device's own contribution.
export async function refreshExternalPrices(serverId: string, ids: string[], hdv: { tab: string; last: boolean }): Promise<RefreshOutcome> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/external-prices/refresh`, {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ serverId, ids, tab: hdv.tab, last: hdv.last }),
    });
  } catch {
    return { status: 'unreachable' };
  }
  if (response.status === 429) {
    // Two refusals share this status: a read too close to the previous one, and the tab's hourly limit.
    const refusal: unknown = await response.json().catch(() => undefined);
    if (isRecord(refusal) && refusal.error === 'hourly-limit') {
      return { status: 'hourly-limit', retryAt: typeof refusal.retryAt === 'string' ? refusal.retryAt : undefined };
    }
    return { status: 'too-soon' };
  }
  if (response.status === 404) return { status: 'unknown-server' };
  if (response.status === 503) return { status: 'disabled' };
  if (!response.ok) return { status: 'unavailable' };
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { status: 'unavailable' };
  }
  if (!isRecord(payload) || typeof payload.refreshed !== 'number') return { status: 'unavailable' };
  if (payload.refreshed > 0) markFreshReads();
  return { status: 'ok', refreshed: payload.refreshed, requests: typeof payload.requests === 'number' ? payload.requests : undefined };
}

// specs/047-recherche-refresh-prices (contracts/recherche-refresh-ui.md): asks the API to read again,
// on Huzounet, the price of the item shown on the Recherche page and of the resources of its recipe.
// `itemId` tells the API which of the ids is an item players look at. Never throws. After a read that
// went through, the next reads are fresh ones, like after this device's own contribution.
export async function refreshRecipePrices(serverId: string, itemId: string, ids: string[]): Promise<RecipeRefreshOutcome> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/external-prices/refresh`, {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ serverId, itemId, ids }),
    });
  } catch {
    return { status: 'unavailable' };
  }
  if (response.status === 429) return { status: 'too-soon' };
  if (response.status === 404) return { status: 'not-read' };
  if (!response.ok) return { status: 'unavailable' };
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { status: 'unavailable' };
  }
  if (!isRecord(payload) || typeof payload.refreshed !== 'number') return { status: 'unavailable' };
  markFreshReads();
  return { status: 'ok', refreshed: payload.refreshed };
}
