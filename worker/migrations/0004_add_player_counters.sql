-- specs/014-admin-counters: humorous per-player counters, read publicly by the site
-- (GET /player-counters) and edited only through the Access-protected dofus-craft-admin Worker.
-- Apply with: npm run worker:db:migrate-player-counters
CREATE TABLE IF NOT EXISTS player_counters (
  id TEXT PRIMARY KEY,
  player TEXT NOT NULL,
  breed_id INTEGER NOT NULL,
  sex TEXT NOT NULL CHECK (sex IN ('m', 'f')),
  count INTEGER NOT NULL CHECK (count >= 0),
  at_least INTEGER NOT NULL DEFAULT 0 CHECK (at_least IN (0, 1)),
  unit_one TEXT NOT NULL,
  unit_many TEXT NOT NULL,
  target_item_id INTEGER NOT NULL,
  target_name TEXT NOT NULL,
  target_icon TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_player_counters_created_at ON player_counters (created_at);

-- The two counters that were hard-coded in specs/013, carried over as they were.
INSERT OR IGNORE INTO player_counters
  (id, player, breed_id, sex, count, at_least, unit_one, unit_many, target_item_id, target_name, target_icon, created_at, updated_at)
VALUES
  ('le-lanceurdeglyphe', 'Le-Lanceurdeglyphe', 1, 'm', 150, 1, 'donjon sans drop', 'donjons sans drop',
   21189, 'Parangon de puissance', 'https://api.dofusdb.fr/img/items/50733.png',
   '2026-09-24T00:00:00.000Z', '2026-09-24T00:00:00.000Z'),
  ('nicomoux', 'Nicomoux', 12, 'm', 157, 0, 'tentative de FM', 'tentatives de FM',
   14094, 'Amulette du Strigide', 'https://api.dofusdb.fr/img/items/1235.png',
   '2026-09-24T00:00:01.000Z', '2026-09-24T00:00:01.000Z');
