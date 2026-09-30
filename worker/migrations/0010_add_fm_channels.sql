-- specs/029-channel-ownership: the personal FM channels the Discord bot creates (one owner each), and a
-- `create-channel` request in the bot's queue. Run once via `npm run worker:db:migrate-fm-channels`, before
-- deploying the Worker that uses it (see worker/schema.sql for freshly created databases).
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

-- fm_bot_commands is rebuilt: its CHECK on `type` must accept 'create-channel', and a create-channel
-- request has no session nor channel yet.
CREATE TABLE fm_bot_commands_new (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('open', 'close', 'create-channel')),
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

INSERT INTO fm_bot_commands_new (id, type, session_id, channel_id, status, error, created_at, acknowledged_at)
  SELECT id, type, session_id, channel_id, status, error, created_at, acknowledged_at FROM fm_bot_commands;

DROP TABLE fm_bot_commands;
ALTER TABLE fm_bot_commands_new RENAME TO fm_bot_commands;

CREATE INDEX IF NOT EXISTS idx_fm_bot_commands_status ON fm_bot_commands (status, created_at);
CREATE INDEX IF NOT EXISTS idx_fm_bot_commands_channel ON fm_bot_commands (channel_id, status);
