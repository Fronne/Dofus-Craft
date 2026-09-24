-- Community price sharing (specs/004-community-price-sharing), Cloudflare D1 (SQLite) schema.
--
-- Apply with: npm run worker:db:init (wrangler d1 execute ... --file worker/schema.sql)
-- once the D1 database itself has been created (wrangler d1 create dofus-craft-community-prices)
-- and its id/binding set in worker/wrangler.toml.
--
-- Unlike the previously-considered Postgres/Supabase design, there is no public database API and
-- no Row Level Security here: the Worker in src/index.ts is the *only* thing with access to this
-- database, so access control is enforced entirely by what that Worker's endpoints choose to
-- expose (FR-007: raw contributions are never returned by any endpoint, only the aggregated
-- median computed in src/median.ts).

CREATE TABLE IF NOT EXISTS community_price_contributions (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL,
  server_id TEXT NOT NULL,
  amount_kamas INTEGER NOT NULL CHECK (amount_kamas >= 0),
  -- Anonymous per-device identifier (revision 5, FR-010/FR-021/FR-022): lets contributions from the
  -- same device be recognized as such, never a player identity. Empty for rows inserted before this
  -- revision (see migrations/0001_add_device_id.sql for the already-existing production database).
  device_id TEXT NOT NULL DEFAULT '',
  -- Outlier tracking (specs/007-outlier-confirmation, FR-009): the community median the server knew
  -- for this resource/server just before inserting this row, and the resulting deviation in percent.
  -- Both NULL exactly when no median existed yet at submission time (FR-008) — never a fabricated
  -- comparison. Never read by GET /community-price nor by computeCommunityMedian (FR-010): a
  -- moderator queries `WHERE deviation_percent > 25` directly against this table (see research.md).
  median_at_submission_kamas INTEGER,
  deviation_percent REAL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Every read is scoped to a single (resource_id, server_id) pair (FR-001/FR-003).
CREATE INDEX IF NOT EXISTS idx_community_price_contributions_lookup
  ON community_price_contributions (resource_id, server_id, created_at);

-- specs/006-anonymous-visit-count: anonymous daily presence signal, one row per device per day.
-- The composite primary key is the only deduplication mechanism (no application-level logic).
CREATE TABLE IF NOT EXISTS app_visits (
  device_id TEXT NOT NULL,
  day TEXT NOT NULL,
  PRIMARY KEY (device_id, day)
);

-- specs/014-admin-counters: humorous per-player counters (see migrations/0004_add_player_counters.sql
-- for the initial rows). Read publicly by GET /player-counters, edited only by the dofus-craft-admin
-- Worker behind Cloudflare Access. Nothing about the visitors who read them is stored.
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
