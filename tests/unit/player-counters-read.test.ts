import { describe, expect, it } from 'vitest';
import { counterFromRow, readPlayerCounters, type PlayerCounterRow } from '../../worker/src/player-counters';

const row: PlayerCounterRow = {
  id: 'nicomoux',
  player: 'Nicomoux',
  breed_id: 12,
  sex: 'm',
  count: 157,
  at_least: 0,
  unit_one: 'tentative de FM',
  unit_many: 'tentatives de FM',
  target_item_id: 14094,
  target_name: 'Amulette du Strigide',
  target_icon: 'https://api.dofusdb.fr/img/items/1235.png',
  created_at: '2026-09-24T00:00:01.000Z',
  updated_at: '2026-09-24T00:00:01.000Z',
};

describe('public player counters read (specs/014-admin-counters)', () => {
  it('converts a row to the shared JSON shape', () => {
    expect(counterFromRow({ ...row, at_least: 1 })).toEqual({
      id: 'nicomoux',
      player: 'Nicomoux',
      breedId: 12,
      sex: 'm',
      count: 157,
      atLeast: true,
      unitOne: 'tentative de FM',
      unitMany: 'tentatives de FM',
      target: { itemId: 14094, name: 'Amulette du Strigide', icon: 'https://api.dofusdb.fr/img/items/1235.png' },
      createdAt: '2026-09-24T00:00:01.000Z',
      updatedAt: '2026-09-24T00:00:01.000Z',
    });
  });

  it('lists every counter in creation order', async () => {
    const statements: string[] = [];
    const db = {
      prepare(sql: string) {
        statements.push(sql);
        return { all: async <T,>() => ({ results: [row] as T[] }) };
      },
    };
    await expect(readPlayerCounters(db)).resolves.toHaveLength(1);
    expect(statements[0]).toMatch(/ORDER BY created_at ASC/);
  });
});
