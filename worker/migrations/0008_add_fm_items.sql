-- specs/027-fm-item-recap: the items a player forgemages ("objets en FM"), and the one item an FM
-- session is attached to. Run once via `npm run worker:db:migrate-fm-items`, before deploying the
-- Worker that uses it (see worker/schema.sql for freshly created databases).
CREATE TABLE IF NOT EXISTS fm_items (
  id TEXT PRIMARY KEY,
  owner_discord_user_id TEXT NOT NULL REFERENCES fm_players (discord_user_id),
  -- The catalogue equipment chosen at creation, kept as it was then (FR-003).
  item_id TEXT NOT NULL,
  item_name TEXT NOT NULL,
  item_image_url TEXT,
  -- Optional free name, to tell two copies of the same equipment apart (FR-001).
  label TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fm_items_owner ON fm_items (owner_discord_user_id);

-- At most one item per session (FR-006): a column, not a link table.
ALTER TABLE fm_sessions ADD COLUMN fm_item_id TEXT REFERENCES fm_items (id);

CREATE INDEX IF NOT EXISTS idx_fm_sessions_item ON fm_sessions (fm_item_id);
