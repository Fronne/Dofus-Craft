import { isPlayerCounter, type PlayerCounter } from '../domain/player-counter';

// specs/014-admin-counters: public read of the humorous player counters (contracts/
// player-counters-api.md). Never throws, and rejects a list with any malformed counter rather than
// showing half of it.
export type PlayerCountersRead = { status: 'ok'; counters: PlayerCounter[] } | { status: 'unavailable' };

const API_URL = import.meta.env.VITE_COMMUNITY_API_URL;

export async function getPlayerCounters(): Promise<PlayerCountersRead> {
  try {
    const response = await fetch(`${API_URL}/player-counters`);
    if (!response.ok) return { status: 'unavailable' };
    const payload: unknown = await response.json();
    if (!Array.isArray(payload) || !payload.every(isPlayerCounter)) return { status: 'unavailable' };
    return { status: 'ok', counters: payload };
  } catch {
    return { status: 'unavailable' };
  }
}
