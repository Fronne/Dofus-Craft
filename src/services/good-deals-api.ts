import { DEFAULT_THRESHOLD_PERCENT, type JetLine, type Listing } from '../domain/good-deals';

// specs/078-bons-plans-hdv (contracts/bons-plans-api.md): the fresh equipment announcements of a server.
// Never throws: any failure means "unknown", and the page says it could not read them.
const API_URL = import.meta.env.VITE_COMMUNITY_API_URL;

export type GoodDealsPayload = { thresholdPercent: number; listings: Listing[] };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

function toStats(value: unknown): JetLine[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const lines: JetLine[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.effectId !== 'number' || typeof entry.value !== 'number') return undefined;
    lines.push({ effectId: entry.effectId, value: entry.value });
  }
  return lines;
}

/** Reads the answer back; an announcement of the wrong shape is dropped, an answer of the wrong shape is refused. */
export function parseGoodDealsPayload(value: unknown): GoodDealsPayload | undefined {
  if (!isRecord(value) || !Array.isArray(value.listings)) return undefined;
  const threshold = typeof value.thresholdPercent === 'number' && value.thresholdPercent > 0 ? value.thresholdPercent : DEFAULT_THRESHOLD_PERCENT;
  const listings: Listing[] = [];
  for (const entry of value.listings) {
    if (!isRecord(entry)) continue;
    const stats = toStats(entry.stats);
    if (typeof entry.listingId !== 'string' || typeof entry.itemId !== 'string' || typeof entry.priceKamas !== 'number' || !stats) continue;
    listings.push({
      listingId: entry.listingId,
      itemId: entry.itemId,
      priceKamas: entry.priceKamas,
      stats,
      lastSeenAt: typeof entry.lastSeenAt === 'string' ? entry.lastSeenAt : undefined,
    });
  }
  return { thresholdPercent: threshold, listings };
}

export async function getGoodDealsPayload(serverId: string): Promise<GoodDealsPayload | undefined> {
  try {
    const response = await fetch(`${API_URL}/bons-plans?server=${encodeURIComponent(serverId)}`);
    if (!response.ok) return undefined;
    return parseGoodDealsPayload(await response.json());
  } catch {
    return undefined;
  }
}
