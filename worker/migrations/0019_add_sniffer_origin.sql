-- specs/056-sniffer-batch-prices: a price sent by the friends' tool is recorded with origin 'sniffer'.
-- SQLite can't change a CHECK constraint, so the table is rebuilt with the wider origin list and every
-- contribution is copied over (columns unchanged).
-- COST: the copy writes every existing row (and its index entry) once — count the rows first
-- (SELECT COUNT(*) FROM community_price_contributions) against the free plan's 100k rows written a day.
-- BEFORE: export a backup (wrangler d1 export --remote) and apply outside the Huzounet runs (02:00-05:00
-- UTC): a contribution written between the copy and the DROP below would not be in the new table.
-- Apply with: npm run worker:db:migrate-sniffer-origin
-- specs/071: never run it again once 0024 is applied — its copy would drop the item_type column.
-- A copy left by a run stopped before its end is never thrown away (it may hold the only copy of the
-- rows): it is completed. If a run stopped after the DROP, community_price_contributions no longer
-- exists and the copy below fails — then run only the last two statements (RENAME and CREATE INDEX).
CREATE TABLE IF NOT EXISTS community_price_contributions_new (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL,
  server_id TEXT NOT NULL,
  amount_kamas INTEGER NOT NULL CHECK (amount_kamas >= 0),
  device_id TEXT NOT NULL DEFAULT '',
  median_at_submission_kamas INTEGER,
  deviation_percent REAL,
  kind TEXT NOT NULL DEFAULT 'resource' CHECK (kind IN ('resource', 'item')),
  origin TEXT NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual', 'capture', 'bot', 'sniffer')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
INSERT OR IGNORE INTO community_price_contributions_new
  (id, resource_id, server_id, amount_kamas, device_id, median_at_submission_kamas, deviation_percent, kind, origin, created_at)
  SELECT id, resource_id, server_id, amount_kamas, device_id, median_at_submission_kamas, deviation_percent, kind, origin, created_at
  FROM community_price_contributions;
DROP TABLE community_price_contributions;
ALTER TABLE community_price_contributions_new RENAME TO community_price_contributions;
CREATE INDEX IF NOT EXISTS idx_community_price_contributions_lookup
  ON community_price_contributions (resource_id, server_id, created_at);
