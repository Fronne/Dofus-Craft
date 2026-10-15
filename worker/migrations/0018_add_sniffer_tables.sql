-- specs/056-sniffer-batch-prices: the friends' price tool (SniffSniffSquared) — its keys, the decoding
-- mappings served to it per game client build, and each key's daily count of written prices.
-- Apply with: npm run worker:db:migrate-sniffer-tables

-- One key per friend. Only the key's SHA-256 (lowercase hex) is stored, never the key itself. `id`
-- becomes the device_id of every contribution sent with the key. A revoked key is refused (401).
CREATE TABLE IF NOT EXISTS sniffer_keys (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  revoked_at TEXT,
  last_seen_at TEXT
);

-- keymap.json + schema.json for one game client build, kept as history so an older one can be made
-- active again. At most one active mapping per build.
CREATE TABLE IF NOT EXISTS sniffer_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  build TEXT NOT NULL,
  keymap_json TEXT NOT NULL,
  schema_json TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0, 1))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sniffer_mappings_active_build
  ON sniffer_mappings (build) WHERE active = 1;

-- Prices written by a key on a UTC day (YYYY-MM-DD), for the daily cap of POST /community-price/batch.
CREATE TABLE IF NOT EXISTS sniffer_daily_usage (
  key_id TEXT NOT NULL,
  day TEXT NOT NULL,
  rows_written INTEGER NOT NULL DEFAULT 0 CHECK (rows_written >= 0),
  PRIMARY KEY (key_id, day)
);
