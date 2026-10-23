-- specs/073-admin-nettoyage-donnees: the trace of the rows the administration page deletes (which table, how
-- many, by selection or by duration, with which filter). A new table only: no existing row is read or rewritten.
-- ORDER: apply it BEFORE deploying the administration Worker of specs/073 — every deletion writes a trace.
-- Apply with: npm run worker:db:migrate-cleanup-log
CREATE TABLE IF NOT EXISTS admin_cleanup_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deleted_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  table_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('selection', 'duration')),
  filter_text TEXT NOT NULL DEFAULT '',
  row_count INTEGER NOT NULL CHECK (row_count > 0)
);
CREATE INDEX IF NOT EXISTS idx_admin_cleanup_log_deleted_at ON admin_cleanup_log (deleted_at);
