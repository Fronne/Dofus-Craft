-- specs/045-restore-production-worker: 'archive-channel' and 'reopen-channel' requests in the bot's
-- queue. fm_bot_commands is rebuilt, its CHECK on `type` having to accept them. Written from the
-- production database's structure (the original migration is lost); production already has it.
CREATE TABLE fm_bot_commands_new (
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

INSERT INTO fm_bot_commands_new (id, type, session_id, channel_id, status, error, created_at, acknowledged_at, requested_name, requester_discord_user_id, fm_item_id, result_channel_id)
  SELECT id, type, session_id, channel_id, status, error, created_at, acknowledged_at, requested_name, requester_discord_user_id, fm_item_id, result_channel_id FROM fm_bot_commands;

DROP TABLE fm_bot_commands;
ALTER TABLE fm_bot_commands_new RENAME TO fm_bot_commands;

CREATE INDEX IF NOT EXISTS idx_fm_bot_commands_status ON fm_bot_commands (status, created_at);
CREATE INDEX IF NOT EXISTS idx_fm_bot_commands_channel ON fm_bot_commands (channel_id, status);
