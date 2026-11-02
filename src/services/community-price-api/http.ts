export const API_URL = import.meta.env.VITE_COMMUNITY_API_URL;
export const API_KEY = import.meta.env.VITE_COMMUNITY_API_KEY;

export function apiHeaders(extra?: Record<string, string>): HeadersInit {
  return {
    Authorization: `Bearer ${API_KEY}`,
    ...extra,
  };
}

// specs/021-background-data-loading (FR-013): price reads may be served from a 60-second cache
// (the Worker's and the browser's). For that long after this device's own accepted contribution,
// every read asks for fresh data, so the player always sees what they just shared — on the page
// where they typed it as on the Prix and Suivis pages.
const FRESH_READ_WINDOW_MS = 60_000;
let freshReadsUntil = 0;

export function readParams(values: Record<string, string>): URLSearchParams {
  const params = new URLSearchParams(values);
  if (Date.now() < freshReadsUntil) params.set('fresh', '1');
  return params;
}

// A fresh read bypasses the browser's HTTP cache too, not only the Worker's.
export function readInit(): RequestInit {
  return Date.now() < freshReadsUntil ? { headers: apiHeaders(), cache: 'no-store' } : { headers: apiHeaders() };
}

// Called after this device's own accepted contribution, or after a read that went through.
export function markFreshReads(): void {
  freshReadsUntil = Date.now() + FRESH_READ_WINDOW_MS;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
