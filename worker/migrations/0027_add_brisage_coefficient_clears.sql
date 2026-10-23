-- specs/069-coefficients-brisage-partages: a player can say « I don't know the coefficient » for an item. The note is
-- kept here, apart from brisage_coefficients (whose coefficient must stay above 0): a coefficient noted before the
-- latest clear of its item is no longer given. A new table only: no existing row is read or rewritten.
-- Apply with: npm run worker:db:migrate-coefficient-clears (BEFORE deploying the Worker that writes to it)
CREATE TABLE IF NOT EXISTS brisage_coefficient_clears (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  cleared_at TEXT NOT NULL,
  device_id TEXT NOT NULL DEFAULT '',
  UNIQUE (server_id, item_id, cleared_at, device_id)
);
CREATE INDEX IF NOT EXISTS idx_brisage_coefficient_clears_item ON brisage_coefficient_clears (server_id, item_id, cleared_at);
CREATE INDEX IF NOT EXISTS idx_brisage_coefficient_clears_at ON brisage_coefficient_clears (cleared_at);
