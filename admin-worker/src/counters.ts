import type { PlayerCounterInput } from '../../src/domain/player-counter';
import { counterFromRow, SELECT_COUNTERS, type PlayerCounterJson, type PlayerCounterRow } from '../../worker/src/player-counters';

// specs/014-admin-counters: writes on the player_counters table, reachable only through the
// Access-protected API (src/index.ts). Input is validated before it gets here.

type Statement = {
  bind(...values: unknown[]): Statement;
  all<T>(): Promise<{ results: T[] }>;
  first<T>(): Promise<T | null>;
  run(): Promise<{ meta: { changes: number } }>;
};
export type CountersDb = { prepare(sql: string): Statement };

export const INSERT_COLUMNS = [
  'id', 'player', 'breed_id', 'sex', 'count', 'at_least', 'unit_one', 'unit_many',
  'target_item_id', 'target_name', 'target_icon', 'created_at', 'updated_at',
] as const;

// Input field → column(s), so an update only ever sets the fields it received.
function columnsFor(input: Partial<PlayerCounterInput>): [string, unknown][] {
  const columns: [string, unknown][] = [];
  if (input.player !== undefined) columns.push(['player', input.player]);
  if (input.breedId !== undefined) columns.push(['breed_id', input.breedId]);
  if (input.sex !== undefined) columns.push(['sex', input.sex]);
  if (input.count !== undefined) columns.push(['count', input.count]);
  if (input.atLeast !== undefined) columns.push(['at_least', input.atLeast ? 1 : 0]);
  if (input.unitOne !== undefined) columns.push(['unit_one', input.unitOne]);
  if (input.unitMany !== undefined) columns.push(['unit_many', input.unitMany]);
  if (input.target !== undefined) {
    columns.push(['target_item_id', input.target.itemId], ['target_name', input.target.name], ['target_icon', input.target.icon]);
  }
  return columns;
}

export async function listCounters(db: CountersDb): Promise<PlayerCounterJson[]> {
  const { results } = await db.prepare(SELECT_COUNTERS).all<PlayerCounterRow>();
  return results.map(counterFromRow);
}

async function getCounter(db: CountersDb, id: string): Promise<PlayerCounterJson | null> {
  const row = await db.prepare('SELECT * FROM player_counters WHERE id = ?').bind(id).first<PlayerCounterRow>();
  return row ? counterFromRow(row) : null;
}

export async function createCounter(
  db: CountersDb,
  input: PlayerCounterInput,
  id: string = crypto.randomUUID(),
  now: string = new Date().toISOString(),
): Promise<PlayerCounterJson> {
  const values: Record<(typeof INSERT_COLUMNS)[number], unknown> = {
    id,
    player: input.player,
    breed_id: input.breedId,
    sex: input.sex,
    count: input.count,
    at_least: input.atLeast ? 1 : 0,
    unit_one: input.unitOne,
    unit_many: input.unitMany,
    target_item_id: input.target.itemId,
    target_name: input.target.name,
    target_icon: input.target.icon,
    created_at: now,
    updated_at: now,
  };
  await db.prepare(`INSERT INTO player_counters (${INSERT_COLUMNS.join(', ')}) VALUES (${INSERT_COLUMNS.map(() => '?').join(', ')})`)
    .bind(...INSERT_COLUMNS.map((column) => values[column]))
    .run();
  return (await getCounter(db, id))!;
}

export async function updateCounter(
  db: CountersDb,
  id: string,
  input: Partial<PlayerCounterInput>,
  now: string = new Date().toISOString(),
): Promise<PlayerCounterJson | null> {
  const columns = [...columnsFor(input), ['updated_at', now] as [string, unknown]];
  const result = await db.prepare(`UPDATE player_counters SET ${columns.map(([column]) => `${column} = ?`).join(', ')} WHERE id = ?`)
    .bind(...columns.map(([, value]) => value), id)
    .run();
  return result.meta.changes > 0 ? getCounter(db, id) : null;
}

export async function deleteCounter(db: CountersDb, id: string): Promise<boolean> {
  const result = await db.prepare('DELETE FROM player_counters WHERE id = ?').bind(id).run();
  return result.meta.changes > 0;
}
