-- specs/025-rune-purchase-import: the Forgemagie page (profiles, the Discord bot's FM sessions, rune
-- prices) and the origin of every shared price. Existing contributions are all manual entries, hence
-- the default. Run once via `npm run worker:db:migrate-forgemagie`, before deploying the Worker that
-- uses it (see worker/schema.sql for freshly created databases).
ALTER TABLE community_price_contributions ADD COLUMN origin TEXT NOT NULL DEFAULT 'manual'
  CHECK (origin IN ('manual', 'capture', 'bot'));

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

-- An FM session of a Discord channel: at most one open session per channel, like the bot.
CREATE TABLE IF NOT EXISTS fm_sessions (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
  opened_at TEXT NOT NULL,
  closed_at TEXT
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
