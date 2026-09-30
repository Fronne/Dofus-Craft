-- specs/028-site-started-sessions: FM sessions started and stopped from the site, and the queue of
-- requests the Discord bot fetches every 10 seconds. Run once via `npm run worker:db:migrate-site-sessions`,
-- before deploying the Worker that uses it (see worker/schema.sql for freshly created databases).
ALTER TABLE fm_sessions ADD COLUMN owner_discord_user_id TEXT REFERENCES fm_players (discord_user_id);
ALTER TABLE fm_sessions ADD COLUMN origin TEXT NOT NULL DEFAULT 'discord' CHECK (origin IN ('discord', 'site'));
ALTER TABLE fm_sessions ADD COLUMN sync_status TEXT CHECK (sync_status IN ('pending', 'opened', 'failed', 'cancelled'));
ALTER TABLE fm_sessions ADD COLUMN sync_error TEXT;

CREATE TABLE IF NOT EXISTS fm_bot_commands (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('open', 'close')),
  session_id TEXT NOT NULL REFERENCES fm_sessions (id),
  channel_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'done', 'failed', 'cancelled')),
  error TEXT,
  created_at TEXT NOT NULL,
  acknowledged_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_fm_bot_commands_status ON fm_bot_commands (status, created_at);
CREATE INDEX IF NOT EXISTS idx_fm_bot_commands_channel ON fm_bot_commands (channel_id, status);
