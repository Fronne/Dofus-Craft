-- specs/078-bons-plans-hdv: one row per equipment copy on sale at the HDV, sent by the friends' tool
-- with its price and rolled stats. Rows are only served while seen within the last 24 hours.
-- Apply with: npm run worker:db:migrate-hdv-listings
CREATE TABLE IF NOT EXISTS hdv_listings (
  server_id TEXT NOT NULL,
  listing_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  price_kamas INTEGER NOT NULL CHECK (price_kamas > 0),
  -- JSON array of {effectId, value}, 1 to 40 lines.
  stats_json TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  -- The sniffer key that saw it. Never returned by the API.
  key_id TEXT NOT NULL,
  PRIMARY KEY (server_id, listing_id)
);
CREATE INDEX IF NOT EXISTS idx_hdv_listings_seen ON hdv_listings (server_id, last_seen_at);
CREATE INDEX IF NOT EXISTS idx_hdv_listings_item ON hdv_listings (server_id, item_id);

-- Copies a key wrote on a UTC day, for their own daily cap (the observations keep rows_written).
-- Apply BEFORE deploying the Worker: /community-price/batch reads this column, so without it the route fails.
-- Run ONCE: SQLite has no ADD COLUMN IF NOT EXISTS, so a second run stops here with « duplicate column name ».
ALTER TABLE sniffer_daily_usage ADD COLUMN copies_written INTEGER NOT NULL DEFAULT 0 CHECK (copies_written >= 0);

-- The good deal threshold (percent). site_settings only holds 0/1 for a fixed list of pages, so a number
-- gets a table of its own; the Access-protected admin Worker is the only writer.
CREATE TABLE IF NOT EXISTS numeric_settings (
  key TEXT PRIMARY KEY CHECK (key IN ('good_deal_threshold')),
  value INTEGER NOT NULL CHECK (value BETWEEN 5 AND 90),
  updated_at TEXT NOT NULL
);
