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
  -- capture imported on the site, or a purchase sent by the Discord bot. specs/056: or a price sent by
  -- the friends' HDV tool ('sniffer', see migrations/0019_add_sniffer_origin.sql).
  origin TEXT NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual', 'capture', 'bot', 'sniffer')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  -- specs/071-sniffer-tous-hdv (migrations/0022_add_contribution_item_type.sql, so last, as ADD COLUMN
  -- puts it): the nature of a price sent by the friends' tool 0.4.0+, from the HDV's item type; NULL
  -- otherwise.
  item_type TEXT CHECK (item_type IN ('equipment', 'resource', 'rune', 'consumable'))
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

-- specs/050-forgemagie-page-toggle: the owner's site settings (see
-- migrations/0016_add_site_settings.sql, keys widened by 0017_add_hdv_page_setting.sql for
-- specs/053-hdv-page-toggle). Written only by the dofus-craft-admin Worker.
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY CHECK (key IN ('forgemagie_page', 'hdv_page')),
  value TEXT NOT NULL CHECK (value IN ('0', '1')),
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
  fm_item_id TEXT REFERENCES fm_items (id),
  -- specs/028-site-started-sessions: who started it (site) or typed /fmstart; NULL for older sessions.
  owner_discord_user_id TEXT REFERENCES fm_players (discord_user_id),
  origin TEXT NOT NULL DEFAULT 'discord' CHECK (origin IN ('discord', 'site')),
  -- For a session started on the site: whether the bot opened it in Discord yet.
  sync_status TEXT CHECK (sync_status IN ('pending', 'opened', 'failed', 'cancelled')),
  sync_error TEXT
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
  price_status TEXT NOT NULL CHECK (price_status IN ('recorded', 'unknown-item', 'ambiguous-item', 'no-server', 'outlier', 'personal-mode')),
  -- specs/045-restore-production-worker: what was read first, once the player corrected the line.
  original_quantity INTEGER,
  original_total_kamas INTEGER,
  corrected_at TEXT,
  -- The name as it was read, when it had to be recovered; 0 for a line that is not a rune.
  original_item_name TEXT,
  counted INTEGER NOT NULL DEFAULT 1
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

-- specs/028-site-started-sessions: requests to the Discord bot (open / close a session), which it
-- fetches every 10 seconds and acknowledges; an acknowledged request is never handed out again.
-- specs/029-channel-ownership: plus 'create-channel', which has no session nor channel yet.
-- specs/045-restore-production-worker: plus 'archive-channel' and 'reopen-channel'.
CREATE TABLE IF NOT EXISTS fm_bot_commands (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('open', 'close', 'create-channel', 'archive-channel', 'reopen-channel')),
  session_id TEXT REFERENCES fm_sessions (id),
  channel_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'done', 'failed', 'cancelled')),
  error TEXT,
  created_at TEXT NOT NULL,
  acknowledged_at TEXT,
  requested_name TEXT,
  requester_discord_user_id TEXT,
  fm_item_id TEXT,
  result_channel_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_fm_bot_commands_status ON fm_bot_commands (status, created_at);
CREATE INDEX IF NOT EXISTS idx_fm_bot_commands_channel ON fm_bot_commands (channel_id, status);

-- specs/029-channel-ownership: the personal FM channels the Discord bot creates, one owner each. Filled
-- only by the bot's events; an item attached here counts for every session of the channel (FR-011).
CREATE TABLE IF NOT EXISTS fm_channels (
  channel_id TEXT PRIMARY KEY,
  channel_name TEXT NOT NULL,
  owner_discord_user_id TEXT REFERENCES fm_players (discord_user_id),
  status TEXT NOT NULL CHECK (status IN ('active', 'archived', 'deleted')),
  fm_item_id TEXT REFERENCES fm_items (id),
  created_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_fm_channels_owner ON fm_channels (owner_discord_user_id, status);

-- specs/045-restore-production-worker: the name of the group's Discord server, read at each login.
CREATE TABLE IF NOT EXISTS fm_guild (
  id TEXT PRIMARY KEY CHECK (id = 'current'),
  name TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- specs/045-restore-production-worker: prices read from an outside source (Huzounet), kept beside the
-- prices the players share (src/external-price.ts), and where each scheduled read stopped (src/huzounet.ts).
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

-- specs/056-sniffer-batch-prices (migrations/0018_add_sniffer_tables.sql): the friends' price tool.

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

-- specs/059-prix-par-lot (migrations/0020_add_lot_prices.sql): the last price seen for each HDV lot
-- size of a resource, sent by the friends' tool. The contributions above stay the lot 1 price.
CREATE TABLE IF NOT EXISTS community_price_lots (
  resource_id TEXT NOT NULL,
  server_id TEXT NOT NULL,
  lot_size INTEGER NOT NULL CHECK (lot_size IN (1, 10, 100, 1000)),
  lot_price_kamas INTEGER NOT NULL CHECK (lot_price_kamas > 0),
  observed_at TEXT NOT NULL,
  device_id TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (resource_id, server_id, lot_size)
);

-- specs/069-coefficients-brisage-partages (migrations/0021_add_brisage_coefficients.sql): the breaking
-- coefficients noted on the Brisage page, shared between players, kept 90 days.
CREATE TABLE IF NOT EXISTS brisage_coefficients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  server_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  coefficient REAL NOT NULL CHECK (coefficient > 0 AND coefficient <= 4000),
  noted_at TEXT NOT NULL,
  device_id TEXT NOT NULL DEFAULT '',
  UNIQUE (server_id, item_id, noted_at, device_id)
);
CREATE INDEX IF NOT EXISTS idx_brisage_coefficients_item ON brisage_coefficients (server_id, item_id, noted_at);
CREATE INDEX IF NOT EXISTS idx_brisage_coefficients_noted_at ON brisage_coefficients (noted_at);
