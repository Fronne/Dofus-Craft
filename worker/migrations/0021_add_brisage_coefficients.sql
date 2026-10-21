-- specs/069-coefficients-brisage-partages: the breaking coefficients players note on the Brisage page,
-- shared between all players. History kept 90 days (purged by the weekly cron, worker/src/brisage-coefficients.ts).
-- A new table only: no existing row is read or rewritten.
-- Apply with: npm run worker:db:migrate-brisage-coefficients
CREATE TABLE IF NOT EXISTS brisage_coefficients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  coefficient REAL NOT NULL CHECK (coefficient > 0 AND coefficient <= 4000),
  noted_at TEXT NOT NULL,
  -- The anonymous device identifier of the contributor. Never returned by the API.
  device_id TEXT NOT NULL DEFAULT '',
  -- Sending the same note twice (a retried import) changes nothing.
  UNIQUE (server_id, item_id, noted_at, device_id)
);
CREATE INDEX IF NOT EXISTS idx_brisage_coefficients_item ON brisage_coefficients (server_id, item_id, noted_at);
CREATE INDEX IF NOT EXISTS idx_brisage_coefficients_noted_at ON brisage_coefficients (noted_at);
