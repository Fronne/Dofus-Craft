import { getOrCreateVisitDeviceId } from '../persistence/visit-device-id';

const API_URL = import.meta.env.VITE_COMMUNITY_API_URL;
const API_KEY = import.meta.env.VITE_COMMUNITY_API_KEY;

// Fire-and-forget anonymous daily presence signal (specs/006-anonymous-visit-count), sent on every
// app load regardless of price mode (amends specs/004-community-price-sharing FR-015). Never
// throws and never returns anything callers need to check — a failure here must never be visible
// to the player (FR-007).
export async function recordVisit(): Promise<void> {
  const deviceId = getOrCreateVisitDeviceId();
  try {
    await fetch(`${API_URL}/visit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ deviceId }),
    });
  } catch {
    // Network error or unreachable backend — silently ignored, never surfaced to the player.
  }
}
