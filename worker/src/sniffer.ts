import { contributionInsert, fetchCurrentMedians, MAX_AMOUNT_KAMAS, MAX_BATCH_RESOURCE_IDS } from './contribution';
import { sha256Hex } from './fm/http';
import type { ContributionsSummary } from './median';
import { itemTypeOf, type ItemType } from './item-types';
import { readLatestItemContributions } from './latest';
import { lotPriceStatements } from './lot-prices';
import { isKnownResource } from './resource-catalogue';
import { isKnownServer, SERVERS } from './servers';
import { LOT_SIZES, unitPrice, type Ladder, type LotSize } from './unit-price';

// specs/056-sniffer-batch-prices (contracts/sniffer-api.md): the routes of the friends' HDV price tool,
// GET /sniffer/config and POST /community-price/batch. Each friend has their own key (sniffer_keys),
// never the public COMMUNITY_API_KEY.

// Small enough for the free plan's limits on one request (research R3).
export const MAX_BATCH_OBSERVATIONS = 200;
// Prices one key may write on a UTC day: the free plan allows 100k rows written a day in all.
export const DAILY_ROW_LIMIT = 5000;

// The D1 calls these need, typed structurally (like contribution.ts) so the module also compiles in
// the app's test setup. D1Database is assignable to it.
type Bound = {
  all<T>(): Promise<{ results: T[] }>;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
};
export type SnifferDb = {
  prepare(sql: string): { bind(...values: unknown[]): Bound };
  batch(statements: Bound[]): Promise<unknown>;
};

export type SnifferEnv = {
  DB: SnifferDb;
  // wrangler.toml [vars] (research R5).
  SNIFFER_MIN_VERSION?: string;
  SNIFFER_DOWNLOAD_URL?: string;
};

export type SnifferResult = { status: number; body: unknown; wrote?: boolean };

// specs/071: 'unknown_category', a category with no nature in item-types.json.
export type RejectReason = 'invalid' | 'not_an_ingredient' | 'no_price' | 'unknown_category';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

// The id of the active key the request carries, or undefined. Only the key's SHA-256 is ever compared
// or stored (FR-001). Every authenticated call records when the key was last seen (FR-002).
export async function authenticateSnifferKey(request: Request, db: SnifferDb, now: Date): Promise<string | undefined> {
  const header = request.headers.get('Authorization') ?? '';
  if (!header.startsWith('Bearer ')) return undefined;
  const key = header.slice('Bearer '.length).trim();
  if (!key) return undefined;
  const row = await db.prepare(`SELECT id FROM sniffer_keys WHERE key_hash = ? AND revoked_at IS NULL`)
    .bind(await sha256Hex(key)).first<{ id: string }>();
  if (!row) return undefined;
  await db.prepare(`UPDATE sniffer_keys SET last_seen_at = ? WHERE id = ?`).bind(now.toISOString(), row.id).run();
  return row.id;
}

// 'X.Y.Z', numbers only; anything else can't be compared (research R7).
function parseVersion(value: unknown): number[] | undefined {
  if (typeof value !== 'string' || !/^\d+\.\d+\.\d+$/.test(value)) return undefined;
  return value.split('.').map(Number);
}

// A tool version absent or unreadable counts as older than any minimum.
export function isToolOutdated(tool: unknown, minVersion: string): boolean {
  const version = parseVersion(tool);
  if (!version) return true;
  const minimum = parseVersion(minVersion) ?? [0, 0, 0];
  for (let i = 0; i < 3; i += 1) {
    if (version[i] !== minimum[i]) return version[i] < minimum[i];
  }
  return false;
}

const minVersionOf = (env: SnifferEnv) => env.SNIFFER_MIN_VERSION ?? '0.0.0';
const downloadUrlOf = (env: SnifferEnv) => env.SNIFFER_DOWNLOAD_URL ?? '';

type MappingRow = { id: number; build: string; keymap_json: string; schema_json: string };

async function readActiveMapping(db: SnifferDb, build: string): Promise<MappingRow | undefined> {
  return (await db.prepare(`SELECT id, build, keymap_json, schema_json FROM sniffer_mappings WHERE build = ? AND active = 1`)
    .bind(build).first<MappingRow>()) ?? undefined;
}

// specs/070-sniffer-mapping-provisoire: the mapping a tool of this build must decode with — the build's
// own active one, else, only for a tool that asked (it checks the decoded prices on the wire before
// sending), the newest active upload of any build. Config and batch share it, so the mapping served and
// the mapping a batch must carry never diverge: once the build gets its own, provisional batches get 409.
// Read only: a friend's key never publishes a mapping.
async function readExpectedMapping(db: SnifferDb, build: string, provisional: boolean): Promise<(MappingRow & { provisional: boolean }) | undefined> {
  const own = await readActiveMapping(db, build);
  if (own) return { ...own, provisional: false };
  if (!provisional) return undefined;
  const fallback = await db.prepare(
    `SELECT id, build, keymap_json, schema_json FROM sniffer_mappings WHERE active = 1 ORDER BY uploaded_at DESC, id DESC LIMIT 1`,
  ).bind().first<MappingRow>();
  return fallback ? { ...fallback, provisional: true } : undefined;
}

// GET /sniffer/config: never a 426 — the tool compares its own version to minVersion, to show the link.
// Only `provisional=1` opts in to the fallback: an older tool would use it without checking anything.
export async function snifferConfigResponse(env: SnifferEnv, url: URL): Promise<SnifferResult> {
  const build = url.searchParams.get('build');
  if (!build) return { status: 400, body: { error: 'build_required' } };
  const row = await readExpectedMapping(env.DB, build, url.searchParams.get('provisional') === '1');
  let mapping: unknown = null;
  if (row) {
    try {
      // `build` stays the mapping's own: a provisional one tells the tool which build it was made for.
      mapping = { id: row.id, build: row.build, keymap: JSON.parse(row.keymap_json), schema: JSON.parse(row.schema_json), provisional: row.provisional };
    } catch {
      // A stored document that doesn't parse is served as no mapping: the tool then pauses (its plan).
      console.error(`Sniffer: mapping ${row.id} for build ${row.build} is not valid JSON`);
    }
  }
  return {
    status: 200,
    body: { minVersion: minVersionOf(env), downloadUrl: downloadUrlOf(env), servers: SERVERS, mapping },
  };
}

// specs/071-sniffer-tous-hdv: `itemType` only when the tool (0.4.0+) sent a category.
type Observation = { itemId: string; ladder: Ladder; itemType?: ItemType };

// One observation of a batch, or the reason it is refused (data-model.md « Observation »).
export function parseObservation(value: unknown): Observation | RejectReason {
  if (!isRecord(value) || !isRecord(value.lots)) return 'invalid';
  const { itemId, seenAt, lots, category } = value;
  if (typeof itemId !== 'string' || !/^\d+$/.test(itemId)) return 'invalid';
  if (typeof seenAt !== 'string' || Number.isNaN(Date.parse(seenAt))) return 'invalid';
  const ladder: Ladder = {};
  for (const [size, price] of Object.entries(lots)) {
    if (!LOT_SIZES.map(String).includes(size)) return 'invalid';
    if (typeof price !== 'number' || !Number.isInteger(price) || price < 0 || price > MAX_AMOUNT_KAMAS) return 'invalid';
    ladder[Number(size) as LotSize] = price;
  }
  const onSale = LOT_SIZES.some((size) => (ladder[size] ?? 0) > 0);
  // A tool older than 0.4.0 sends no category: resources of the site's catalogue only, as in specs/056.
  if (category === undefined) {
    if (!isKnownResource(itemId)) return 'not_an_ingredient';
    return onSale ? { itemId, ladder } : 'no_price';
  }
  // specs/071: the HDV's item type (DofusDB typeId) decides the nature, the catalogue no longer applies.
  if (typeof category !== 'number' || !Number.isInteger(category) || category <= 0) return 'invalid';
  const itemType = itemTypeOf(category);
  if (!itemType) return 'unknown_category';
  // An equipment is one copy: the cheapest one on sale, as lot 1 and nothing else.
  if (itemType === 'equipment' && Object.keys(lots).some((size) => size !== '1')) return 'invalid';
  return onSale ? { itemId, ladder, itemType } : 'no_price';
}

async function readMedians(db: SnifferDb, itemIds: string[], serverId: string): Promise<Map<string, ContributionsSummary>> {
  const unique = [...new Set(itemIds)];
  const medians = new Map<string, ContributionsSummary>();
  for (let start = 0; start < unique.length; start += MAX_BATCH_RESOURCE_IDS) {
    const chunk = await fetchCurrentMedians(db, unique.slice(start, start + MAX_BATCH_RESOURCE_IDS), serverId);
    for (const [id, median] of chunk) medians.set(id, median);
  }
  return medians;
}

async function readLatestItems(db: SnifferDb, itemIds: string[], serverId: string): Promise<Map<string, number>> {
  const unique = [...new Set(itemIds)];
  const latest = new Map<string, number>();
  for (let start = 0; start < unique.length; start += MAX_BATCH_RESOURCE_IDS) {
    const chunk = await readLatestItemContributions(db, unique.slice(start, start + MAX_BATCH_RESOURCE_IDS), serverId);
    for (const [id, price] of chunk) latest.set(id, price);
  }
  return latest;
}

// POST /community-price/batch, the key already authenticated. The checks run in the contract's order;
// the first that fails answers and nothing is written.
export async function snifferBatchResponse(env: SnifferEnv, body: unknown, keyId: string, now: Date): Promise<SnifferResult> {
  if (!isRecord(body) || typeof body.build !== 'string' || !body.build || typeof body.serverId !== 'string' ||
    !Number.isInteger(body.mappingId) || !Array.isArray(body.observations)) {
    return { status: 400, body: { error: 'invalid_body' } };
  }
  const { build, serverId, mappingId, observations } = body as { build: string; serverId: string; mappingId: number; observations: unknown[] };
  const minVersion = minVersionOf(env);
  if (isToolOutdated(body.tool, minVersion)) {
    return { status: 426, body: { error: 'tool_outdated', minVersion, downloadUrl: downloadUrlOf(env) } };
  }
  // Only this route checks the server: the manual price form keeps accepting any id (FR-013).
  if (!isKnownServer(serverId)) return { status: 400, body: { error: 'unknown_server' } };
  if (observations.length > MAX_BATCH_OBSERVATIONS) {
    return { status: 400, body: { error: 'too_many_observations', max: MAX_BATCH_OBSERVATIONS } };
  }
  // The tool decoded these prices with mappingId: if it is no longer the active one for its build (a
  // rollback in the middle of a session), it reloads its config and drops what it had queued. A batch
  // decoded with the fallback says so (`provisional: true`, nothing else counts) and is held to it.
  const expected = await readExpectedMapping(env.DB, build, body.provisional === true);
  if (!expected || expected.id !== mappingId) {
    return { status: 409, body: { error: 'mapping_not_active', activeMappingId: expected?.id ?? null } };
  }

  const rejected: { index: number; reason: RejectReason }[] = [];
  const kept: Observation[] = [];
  observations.forEach((value, index) => {
    const observation = parseObservation(value);
    if (typeof observation === 'string') rejected.push({ index, reason: observation });
    else kept.push(observation);
  });

  // specs/071: an equipment is an item's shared price (kind 'item', specs/016); every other nature is a
  // resource price, as before.
  const equipment = kept.filter((observation) => observation.itemType === 'equipment');
  const resources = kept.filter((observation) => observation.itemType !== 'equipment');
  // specs/059: each resource ladder also writes the price of every lot on sale. The daily cap counts
  // prices (5000 a day, an equipment counting as one), not these extra rows.
  const lotWrites = resources.map(({ itemId, ladder }) => lotPriceStatements(env.DB, serverId, itemId, ladder, keyId, now));
  const day = now.toISOString().slice(0, 10);
  const usage = await env.DB.prepare(`SELECT rows_written FROM sniffer_daily_usage WHERE key_id = ? AND day = ?`)
    .bind(keyId, day).first<{ rows_written: number }>();
  const used = usage?.rows_written ?? 0;
  // A batch that would cross the cap is refused whole: never a partial write (spec, edge cases). Read
  // then written without a lock: two concurrent batches of one key may each pass, so the cap can be
  // crossed by at most one batch per concurrent request — the count itself stays exact.
  if (used + kept.length > DAILY_ROW_LIMIT) {
    return { status: 429, body: { error: 'daily_limit', limit: DAILY_ROW_LIMIT, used } };
  }
  if (kept.length === 0) return { status: 200, body: { accepted: 0, rejected } };

  // The same reference as a manual entry (fetchCurrentMedian's query and aggregation), read once for
  // the whole batch: two observations of one item share the median known before the batch (research R3).
  const medians = await readMedians(env.DB, resources.map((observation) => observation.itemId), serverId);
  const statements = resources.map(({ itemId, ladder, itemType }) => {
    const median = medians.get(itemId);
    // parseObservation kept only ladders with a lot on sale, so a price always exists.
    const price = unitPrice(ladder, median?.medianAmountKamas) as NonNullable<ReturnType<typeof unitPrice>>;
    // Never refused for its deviation: it is measured and stored, the read's IQR filter does the rest.
    return contributionInsert(env.DB, {
      resourceId: itemId,
      serverId,
      amountKamas: price.unitPriceKamas,
      deviceId: keyId,
      kind: 'resource',
      origin: 'sniffer',
      itemType,
    }, median).statement;
  });
  // An equipment's reference is the item's latest shared price, as insertContribution does for an item.
  const latestItems = await readLatestItems(env.DB, equipment.map((observation) => observation.itemId), serverId);
  for (const { itemId, ladder } of equipment) {
    const latest = latestItems.get(itemId);
    statements.push(contributionInsert(env.DB, {
      resourceId: itemId,
      serverId,
      amountKamas: ladder[1] as number,
      deviceId: keyId,
      kind: 'item',
      origin: 'sniffer',
      itemType: 'equipment',
    }, latest === undefined ? undefined : { medianAmountKamas: latest }).statement);
  }
  for (const write of lotWrites) statements.push(...write.statements);
  statements.push(env.DB.prepare(
    `INSERT INTO sniffer_daily_usage (key_id, day, rows_written) VALUES (?, ?, ?)
     ON CONFLICT (key_id, day) DO UPDATE SET rows_written = rows_written + excluded.rows_written`,
  ).bind(keyId, day, kept.length));
  // All or nothing: the prices, the lot prices and the day's count are written together.
  await env.DB.batch(statements);
  return { status: 200, body: { accepted: kept.length, rejected }, wrote: true };
}

// Both routes, or undefined for any other request.
export async function handleSniffer(request: Request, url: URL, env: SnifferEnv, now = new Date()): Promise<SnifferResult | undefined> {
  const isConfig = request.method === 'GET' && url.pathname === '/sniffer/config';
  const isBatch = request.method === 'POST' && url.pathname === '/community-price/batch';
  if (!isConfig && !isBatch) return undefined;
  const keyId = await authenticateSnifferKey(request, env.DB, now);
  if (!keyId) return { status: 401, body: { error: 'unauthorized' } };
  if (isConfig) return snifferConfigResponse(env, url);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { status: 400, body: { error: 'invalid_body' } };
  }
  return snifferBatchResponse(env, body, keyId, now);
}
