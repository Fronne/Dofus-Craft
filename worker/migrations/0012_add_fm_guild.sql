-- specs/045-restore-production-worker: the name of the group's Discord server, read at each login.
-- Written from the production database's structure (the original migration is lost); production
-- already has this table.
CREATE TABLE IF NOT EXISTS fm_guild (
  id TEXT PRIMARY KEY CHECK (id = 'current'),
  name TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
