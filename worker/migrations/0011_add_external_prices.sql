-- specs/045-restore-production-worker: prices read from an outside source (Huzounet), kept beside the
-- prices the players share, and where each scheduled read stopped. Written from the production
-- database's structure, the original migration being lost: production already has these tables, so this
-- file is for freshly created databases only (see worker/schema.sql).
CREATE TABLE IF NOT EXISTS external_prices (
  source TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  server_id TEXT NOT NULL,
  unit_price_kamas INTEGER NOT NULL CHECK (unit_price_kamas >= 1),
  observed_at TEXT NOT NULL,
  support INTEGER NOT NULL DEFAULT 0,
  provisional INTEGER NOT NULL DEFAULT 0,
  stale INTEGER NOT NULL DEFAULT 0,
  fetched_at TEXT NOT NULL,
  -- 1 once the row is the HDV price of an item players look at (its own page, or a price the group shared
  -- for it), not only the price of an ingredient: those are the ones the Rentabilité page lists.
  is_item INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (source, resource_id, server_id)
);

CREATE INDEX IF NOT EXISTS idx_external_prices_lookup ON external_prices (server_id, resource_id);

CREATE TABLE IF NOT EXISTS external_price_sync (
  source TEXT NOT NULL,
  server_id TEXT NOT NULL,
  run_date TEXT NOT NULL,
  cursor INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  last_error TEXT,
  last_error_at TEXT,
  PRIMARY KEY (source, server_id)
);
