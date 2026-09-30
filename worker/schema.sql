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
  -- moderator queries this table directly (see research.md): `WHERE kind = 'resource' AND
  -- deviation_percent > 25` for resources, `WHERE kind = 'item' AND deviation_percent > 50` for items
  -- (specs/016, where the reference is the latest item price rather than a median).
  median_at_submission_kamas INTEGER,
  deviation_percent REAL,
  -- specs/016-shared-item-prices: 'item' for an item's shared HDV price, 'resource' otherwise.
  kind TEXT NOT NULL DEFAULT 'resource' CHECK (kind IN ('resource', 'item')),
  -- specs/025-rune-purchase-import: who or what recorded the price (FR-011) — a manual entry, a
  -- capture imported on the site, or a purchase sent by the Discord bot.
  origin TEXT NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual', 'capture', 'bot')),
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

-- specs/020-info-banner: the one information message shown as a banner (see
-- migrations/0006_add_info_message.sql). Written only by the dofus-craft-admin Worker.
CREATE TABLE IF NOT EXISTS info_message (
  id TEXT PRIMARY KEY CHECK (id = 'current'),
  text TEXT NOT NULL,
  tone TEXT NOT NULL CHECK (tone IN ('info', 'important')),
  ends_at TEXT,
  updated_at TEXT NOT NULL
);

-- specs/025-rune-purchase-import (data-model.md): the Forgemagie page. The only tables holding Discord
-- identifiers; community_price_contributions stays free of player data (research R8).

-- A Discord player, seen by the bot or logged in on the site. Nothing else from Discord is kept (FR-004).
CREATE TABLE IF NOT EXISTS fm_players (
  discord_user_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  -- The Dofus server the bot's purchases are filed under (FR-005); NULL until chosen.
  server_id TEXT,
  is_private INTEGER NOT NULL DEFAULT 0 CHECK (is_private IN (0, 1)),
  first_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Site logins (research R3): only the SHA-256 of the bearer token is stored, never the token.
CREATE TABLE IF NOT EXISTS fm_auth_sessions (
  token_hash TEXT PRIMARY KEY,
  discord_user_id TEXT NOT NULL REFERENCES fm_players (discord_user_id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- OAuth `state` values, kept 10 minutes to protect the Discord callback.
CREATE TABLE IF NOT EXISTS fm_oauth_states (
  state TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL
);

-- specs/027-fm-item-recap: the items a player forgemages ("objets en FM"). The catalogue equipment
-- chosen at creation is kept as it was then (FR-003); `label` tells two copies apart (FR-001).
CREATE TABLE IF NOT EXISTS fm_items (
  id TEXT PRIMARY KEY,
  owner_discord_user_id TEXT NOT NULL REFERENCES fm_players (discord_user_id),
  item_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  item_image_url TEXT,
  label TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fm_items_owner ON fm_items (owner_discord_user_id);

-- An FM session of a Discord channel: at most one open session per channel, like the bot.
CREATE TABLE IF NOT EXISTS fm_sessions (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  -- specs/027-fm-item-recap: the one item this session is attached to, if any (FR-006).
  fm_item_id TEXT REFERENCES fm_items (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fm_sessions_open_channel ON fm_sessions (channel_id) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_fm_sessions_opened_at ON fm_sessions (opened_at);

-- A Discord message processed by the bot, or a capture imported on the site (session_id NULL).
-- spent_kamas is what the bot counts for the player (FR-011), not the sum of the lines.
CREATE TABLE IF NOT EXISTS fm_captures (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES fm_sessions (id),
  discord_user_id TEXT NOT NULL REFERENCES fm_players (discord_user_id),
  origin TEXT NOT NULL CHECK (origin IN ('bot', 'capture')),
  spent_kamas INTEGER NOT NULL CHECK (spent_kamas >= 0),
  -- The player's profile server when the capture was recorded (research R11).
  server_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fm_captures_session ON fm_captures (session_id);
CREATE INDEX IF NOT EXISTS idx_fm_captures_player ON fm_captures (discord_user_id);

-- One purchase line of a capture, and whether it created a resource price (and why not).
CREATE TABLE IF NOT EXISTS fm_purchase_lines (
  id TEXT PRIMARY KEY,
  capture_id TEXT NOT NULL REFERENCES fm_captures (id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  item_name TEXT NOT NULL,
  item_id TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  total_kamas INTEGER NOT NULL CHECK (total_kamas > 0),
  unit_price_kamas INTEGER NOT NULL,
  contribution_id TEXT,
  price_status TEXT NOT NULL CHECK (price_status IN ('recorded', 'unknown-item', 'ambiguous-item', 'no-server', 'outlier', 'personal-mode'))
);

CREATE INDEX IF NOT EXISTS idx_fm_purchase_lines_capture ON fm_purchase_lines (capture_id);

-- Bot events already handled, by Discord message or interaction id (FR-020): a resend returns the
-- stored response and changes nothing.
CREATE TABLE IF NOT EXISTS fm_processed_events (
  event_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  response TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_fm_sessions_item ON fm_sessions (fm_item_id);
