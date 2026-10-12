import { HUZOUNET_SOURCE, type ExternalDb, type ExternalStatement } from './external-price';
import equipmentItems from './equipment-items.json';
import priceableItems from './fm/priceable-items.json';
import pricedExtras from './priced-extras.json';

// specs/045-restore-production-worker: reading the HDV prices Huzounet publishes (huzounet.fr), with its
// author's permission and inside the limits agreed with him: 50 items a request, one request a second,
// 12 requests a scheduled run. Restored from the Worker running in production, its source being lost.
const PRICES_URL = 'https://huzounet.fr/api/market/prices';
const USER_AGENT = 'DofusCraft/1.0 (+https://dofus-craft.handy-apps.workers.dev; lecture autorisee par Huzounet)';
const BATCH_SIZE = 50;
const REQUEST_SPACING_MS = 1000;
const DEFAULT_MAX_REQUESTS = 12;
// Monday (UTC): the day a run also asks for every known item, to discover prices it never had.
const DISCOVERY_DAY = 1;
const MAX_KAMAS = 2_000_000_000;

// The site's server identifiers and Huzounet's.
const SERVER_IDS: Record<string, number> = {
  brial: 351,
  dakal: 353,
  draconiros: 295,
  'hell-mina': 294,
  imagiro: 291,
  kourial: 355,
  mikhal: 354,
  ombre: 50,
  orukam: 292,
  rafal: 350,
  salar: 352,
  'tal-kasha': 290,
  tylezia: 293,
};
const READ_SERVERS = ['mikhal'];

const RESOURCE_IDS = [...new Set([
  ...Object.values(priceableItems.items as Record<string, string | null>).filter((id): id is string => id !== null),
  ...pricedExtras.ids,
])];
const EQUIPMENT_IDS: string[] = equipmentItems.ids;

type Fetcher = (url: string, init: { headers: Record<string, string> }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export type HuzounetOptions = {
  fetch?: Fetcher;
  now?: () => Date;
  wait?: (ms: number) => Promise<void>;
  maxRequests?: number;
  servers?: string[];
  itemIds?: string[];
  equipmentIds?: string[];
};

type PriceRead = { resourceId: string; unitPriceKamas: number; observedAt: string; support: number; provisional: boolean; stale: boolean };
type Batch = { reads: PriceRead[]; leftOut: string[] };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

// 'unknown': the source has no price (nothing changes). 'left-out': it has one it does not stand by
// (contested, excluded) or an absurd one — the price already kept is removed. undefined: unexpected shape.
function parsePrice(resourceId: string, value: unknown): PriceRead | 'unknown' | 'left-out' | undefined {
  if (!isRecord(value)) return undefined;
  if (value.price === null) return 'unknown';
  if (!isRecord(value.price)) return undefined;
  const numerator = Number(value.price.numerator);
  const denominator = Number(value.price.denominator);
  const observed = typeof value.receivedAt === 'string' ? new Date(value.receivedAt) : undefined;
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0 || numerator < 0 || !observed || Number.isNaN(observed.getTime())) return undefined;
  if (value.contested === true || value.excluded === true) return 'left-out';
  const unitPriceKamas = Math.max(1, Math.round(numerator / denominator));
  if (unitPriceKamas > MAX_KAMAS) return 'left-out';
  return {
    resourceId,
    unitPriceKamas,
    observedAt: observed.toISOString(),
    support: typeof value.support === 'number' && Number.isFinite(value.support) ? Math.max(0, Math.round(value.support)) : 0,
    provisional: value.provisional === true,
    stale: value.stale === true,
  };
}

async function readBatch(fetcher: Fetcher, server: number, ids: string[]): Promise<Batch> {
  const response = await fetcher(`${PRICES_URL}?server=${server}&items=${ids.join(',')}`, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Huzounet a répondu ${response.status}`);
  const payload = await response.json();
  if (!isRecord(payload) || !isRecord(payload.prices)) throw new Error('Réponse de Huzounet inattendue : pas de prix');
  const reads: PriceRead[] = [];
  const leftOut: string[] = [];
  for (const [resourceId, value] of Object.entries(payload.prices)) {
    if (!ids.includes(resourceId)) continue;
    const parsed = parsePrice(resourceId, value);
    if (parsed === undefined) throw new Error(`Réponse de Huzounet inattendue pour l'objet ${resourceId}`);
    if (parsed === 'unknown') continue;
    if (parsed === 'left-out') leftOut.push(resourceId);
    else reads.push(parsed);
  }
  return { reads, leftOut };
}

const markItemsSql = (count: number) => `UPDATE external_prices SET is_item = 1
     WHERE source = ? AND server_id = ? AND is_item = 0 AND resource_id IN (${Array.from({ length: count }, () => '?').join(', ')})
       AND EXISTS (SELECT 1 FROM community_price_contributions c
                   WHERE c.server_id = ? AND c.kind = 'item' AND c.resource_id = external_prices.resource_id)`;

function batchStatements(db: ExternalDb, serverId: string, batch: Batch, at: string, equipment: Set<string>, asked: string[]): ExternalStatement[] {
  return [
    ...batch.reads.map((read) => db.prepare(
      `INSERT INTO external_prices (source, resource_id, server_id, unit_price_kamas, observed_at, support, provisional, stale, fetched_at, is_item)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (source, resource_id, server_id) DO UPDATE SET unit_price_kamas = excluded.unit_price_kamas,
         observed_at = excluded.observed_at, support = excluded.support, provisional = excluded.provisional,
         stale = excluded.stale, fetched_at = excluded.fetched_at, is_item = MAX(external_prices.is_item, excluded.is_item)`,
    ).bind(HUZOUNET_SOURCE, read.resourceId, serverId, read.unitPriceKamas, read.observedAt, read.support, read.provisional ? 1 : 0, read.stale ? 1 : 0, at, equipment.has(read.resourceId) ? 1 : 0)),
    ...batch.leftOut.map((resourceId) => db.prepare('DELETE FROM external_prices WHERE source = ? AND resource_id = ? AND server_id = ?').bind(HUZOUNET_SOURCE, resourceId, serverId)),
    db.prepare(markItemsSql(asked.length)).bind(HUZOUNET_SOURCE, serverId, ...asked, serverId),
  ];
}

const PRICED_IDS_SQL = `SELECT resource_id FROM external_prices
     WHERE source = ? AND server_id = ? AND resource_id > ? ORDER BY resource_id LIMIT ?`;
const ITEM_IDS_SQL = `SELECT resource_id FROM external_prices WHERE source = ? AND server_id = ?
     UNION SELECT resource_id FROM community_price_contributions WHERE server_id = ? AND kind = 'item'`;
const SERVER_USED_SQL = `SELECT EXISTS (SELECT 1 FROM fm_players WHERE server_id = ?)
     OR EXISTS (SELECT 1 FROM community_price_contributions WHERE server_id = ?) AS used`;

const isItemId = (id: string) => /^[1-9]\d*$/.test(id);

// The next identifiers to ask for, after the cursor. On a discovery day: every known item, plus the ones
// already priced or shared; any other day: only the ones that already have a price.
async function nextItemIds(db: ExternalDb, serverId: string, known: string[] | undefined, after: string, limit: number): Promise<{ ids: string[]; more: boolean }> {
  if (known) {
    const { results } = await db.prepare(ITEM_IDS_SQL).bind(HUZOUNET_SOURCE, serverId, serverId).all<{ resource_id: string }>();
    const rest = [...new Set([...known, ...results.map((row) => row.resource_id)])].filter((id) => isItemId(id) && id > after).sort();
    return { ids: rest.slice(0, limit), more: rest.length > limit };
  }
  const { results } = await db.prepare(PRICED_IDS_SQL).bind(HUZOUNET_SOURCE, serverId, after, limit + 1).all<{ resource_id: string }>();
  return { ids: results.slice(0, limit).map((row) => row.resource_id), more: results.length > limit };
}

export type SyncResult = { requests: number; written: number; removed: number; servers: string[]; error?: string };

// The scheduled read. A run asks for at most `maxRequests` batches and records where it stopped, so the
// next run of the same day carries on from there; a day's read that is complete is not started again.
export async function syncHuzounetPrices(db: ExternalDb, options: HuzounetOptions = {}): Promise<SyncResult> {
  const fetcher = options.fetch ?? (fetch as unknown as Fetcher);
  const now = options.now ?? (() => new Date());
  const wait = options.wait ?? ((ms: number) => new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  }));
  const maxRequests = options.maxRequests ?? DEFAULT_MAX_REQUESTS;
  const equipmentIds = options.equipmentIds ?? (options.itemIds ? [] : EQUIPMENT_IDS);
  const equipment = new Set(equipmentIds);
  const today = now().toISOString().slice(0, 10);
  const known = now().getUTCDay() === DISCOVERY_DAY ? [...(options.itemIds ?? RESOURCE_IDS), ...equipmentIds] : undefined;
  const result: SyncResult = { requests: 0, written: 0, removed: 0, servers: [] };
  const saveState = (serverId: string, cursor: number, completedAt: string | null) => db.prepare(
    `INSERT INTO external_price_sync (source, server_id, run_date, cursor, completed_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (source, server_id) DO UPDATE SET run_date = excluded.run_date, cursor = excluded.cursor,
       completed_at = COALESCE(excluded.completed_at, external_price_sync.completed_at)`,
  ).bind(HUZOUNET_SOURCE, serverId, today, cursor, completedAt);
  for (const serverId of (options.servers ?? READ_SERVERS).filter((id) => SERVER_IDS[id] !== undefined).sort()) {
    if (result.requests >= maxRequests) return result;
    const state = await db.prepare('SELECT run_date, cursor, completed_at FROM external_price_sync WHERE source = ? AND server_id = ?').bind(HUZOUNET_SOURCE, serverId).first<{ run_date: string; cursor: number; completed_at: string | null }>();
    if (state?.run_date === today && state.completed_at?.slice(0, 10) === today) continue;
    // A server nobody uses is not read.
    if ((await db.prepare(SERVER_USED_SQL).bind(serverId, serverId).first<{ used: number }>())?.used !== 1) continue;
    let after = state?.run_date === today ? String(state.cursor) : '0';
    const page = await nextItemIds(db, serverId, known, after, (maxRequests - result.requests) * BATCH_SIZE);
    if (page.ids.length === 0) {
      await saveState(serverId, Number(after), now().toISOString()).run();
      continue;
    }
    result.servers.push(serverId);
    for (let index = 0; index < page.ids.length; index += BATCH_SIZE) {
      if (result.requests > 0) await wait(REQUEST_SPACING_MS);
      const ids = page.ids.slice(index, index + BATCH_SIZE);
      const at = now().toISOString();
      result.requests += 1;
      let batch: Batch;
      try {
        batch = await readBatch(fetcher, SERVER_IDS[serverId], ids);
      } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
        await db.prepare(
          `INSERT INTO external_price_sync (source, server_id, run_date, cursor, last_error, last_error_at) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT (source, server_id) DO UPDATE SET run_date = excluded.run_date, cursor = excluded.cursor,
             last_error = excluded.last_error, last_error_at = excluded.last_error_at`,
        ).bind(HUZOUNET_SOURCE, serverId, today, Number(after), result.error.slice(0, 300), at).run();
        return result;
      }
      after = ids[ids.length - 1];
      const over = !page.more && index + BATCH_SIZE >= page.ids.length;
      await db.batch([...batchStatements(db, serverId, batch, at, equipment, ids), saveState(serverId, Number(after), over ? at : null)]);
      result.written += batch.reads.length;
      result.removed += batch.leftOut.length;
    }
  }
  return result;
}

// Run with the weekly retention: a price Huzounet stopped publishing is not kept for ever.
export async function purgeStaleExternalPrices(db: { prepare(sql: string): { bind(...values: unknown[]): { run(): Promise<unknown> } } }, cutoff: string): Promise<void> {
  await db.prepare('DELETE FROM external_prices WHERE fetched_at < ?').bind(cutoff).run();
}

const REFRESH_SOURCE = 'huzounet-refresh';
const REFRESH_MAX_IDS = 90;
const REFRESH_COOLDOWN_MS = 2 * 60 * 1000;
const REFRESH_MIN_INTERVAL_MS = 5000;

export type RefreshResult =
  | { status: 'ok'; refreshed: number; requests: number }
  | { status: 'invalid' | 'unknown-server' | 'too-soon' | 'unavailable' };

// POST /external-prices/refresh: a player asks for a recipe's prices now. Only what was not read in the
// last two minutes is asked for, and two reads of a server are at least five seconds apart.
export async function refreshHuzounetPrices(db: ExternalDb, serverId: string, rawIds: unknown, options: HuzounetOptions & { itemId?: string } = {}): Promise<RefreshResult> {
  const equipment = new Set(options.equipmentIds ?? EQUIPMENT_IDS);
  const fetcher = options.fetch ?? (fetch as unknown as Fetcher);
  const now = options.now ?? (() => new Date());
  const wait = options.wait ?? ((ms: number) => new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  }));
  if (!Array.isArray(rawIds) || rawIds.length === 0 || rawIds.length > REFRESH_MAX_IDS || !rawIds.every((id) => typeof id === 'string' && /^\d{1,9}$/.test(id))) {
    return { status: 'invalid' };
  }
  const server = (options.servers ?? READ_SERVERS).includes(serverId) ? SERVER_IDS[serverId] : undefined;
  if (server === undefined) return { status: 'unknown-server' };
  const ids = [...new Set(rawIds as string[])];
  const at = now();
  // The item whose page asked: its price is one players look at (the Rentabilité page lists those).
  const markItem = async () => {
    if (!options.itemId || !ids.includes(options.itemId)) return;
    await db.prepare('UPDATE external_prices SET is_item = 1 WHERE source = ? AND server_id = ? AND resource_id = ?').bind(HUZOUNET_SOURCE, serverId, options.itemId).run();
  };
  const { results: fresh } = await db.prepare(
    `SELECT resource_id FROM external_prices WHERE source = ? AND server_id = ? AND fetched_at >= ? AND resource_id IN (${ids.map(() => '?').join(', ')})`,
  ).bind(HUZOUNET_SOURCE, serverId, new Date(at.getTime() - REFRESH_COOLDOWN_MS).toISOString(), ...ids).all<{ resource_id: string }>();
  const recent = new Set(fresh.map((row) => row.resource_id));
  const wanted = ids.filter((id) => !recent.has(id));
  if (wanted.length === 0) {
    await markItem();
    return { status: 'ok', refreshed: 0, requests: 0 };
  }
  const last = await db.prepare('SELECT run_date FROM external_price_sync WHERE source = ? AND server_id = ?').bind(REFRESH_SOURCE, serverId).first<{ run_date: string }>();
  if (last && at.getTime() - new Date(last.run_date).getTime() < REFRESH_MIN_INTERVAL_MS) return { status: 'too-soon' };
  await db.prepare(
    `INSERT INTO external_price_sync (source, server_id, run_date, cursor) VALUES (?, ?, ?, 0)
     ON CONFLICT (source, server_id) DO UPDATE SET run_date = excluded.run_date`,
  ).bind(REFRESH_SOURCE, serverId, at.toISOString()).run();
  let refreshed = 0;
  let requests = 0;
  for (let index = 0; index < wanted.length; index += BATCH_SIZE) {
    if (requests > 0) await wait(REQUEST_SPACING_MS);
    requests += 1;
    const asked = wanted.slice(index, index + BATCH_SIZE);
    let batch: Batch;
    try {
      batch = await readBatch(fetcher, server, asked);
    } catch {
      return { status: 'unavailable' };
    }
    await db.batch(batchStatements(db, serverId, batch, now().toISOString(), equipment, asked));
    refreshed += batch.reads.length;
  }
  await markItem();
  return { status: 'ok', refreshed, requests };
}
