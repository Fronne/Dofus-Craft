// specs/014-admin-counters: the public read of the humorous player counters. Writes only happen in
// the Access-protected dofus-craft-admin Worker, which shares this row format (counterFromRow).

export type PlayerCounterRow = {
  id: string;
  player: string;
  breed_id: number;
  sex: 'm' | 'f';
  count: number;
  at_least: number;
  unit_one: string;
  unit_many: string;
  target_item_id: number;
  target_name: string;
  target_icon: string;
  created_at: string;
  updated_at: string;
};

export type PlayerCounterJson = {
  id: string;
  player: string;
  breedId: number;
  sex: 'm' | 'f';
  count: number;
  atLeast: boolean;
  unitOne: string;
  unitMany: string;
  target: { itemId: number; name: string; icon: string };
  createdAt: string;
  updatedAt: string;
};

// Typed structurally so the module also compiles in the app's test setup (no Workers types there).
type ReadDb = { prepare(sql: string): { all<T>(): Promise<{ results: T[] }> } };

export const SELECT_COUNTERS = 'SELECT * FROM player_counters ORDER BY created_at ASC';

export function counterFromRow(row: PlayerCounterRow): PlayerCounterJson {
  return {
    id: row.id,
    player: row.player,
    breedId: row.breed_id,
    sex: row.sex,
    count: row.count,
    atLeast: row.at_least === 1,
    unitOne: row.unit_one,
    unitMany: row.unit_many,
    target: { itemId: row.target_item_id, name: row.target_name, icon: row.target_icon },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function readPlayerCounters(db: ReadDb): Promise<PlayerCounterJson[]> {
  const { results } = await db.prepare(SELECT_COUNTERS).all<PlayerCounterRow>();
  return results.map(counterFromRow);
}
