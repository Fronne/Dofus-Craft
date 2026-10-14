-- specs/053-hdv-page-toggle: a second site setting, the HDV page (enabled while no row is saved).
-- SQLite can't change a CHECK constraint, so the table is rebuilt with the wider key list and the
-- Forgemagie setting already saved is copied over.
-- Apply with: npm run worker:db:migrate-hdv-page-setting
-- Can be run again after a run stopped before its end: a half-built copy is thrown away first.
DROP TABLE IF EXISTS site_settings_new;
CREATE TABLE site_settings_new (
  key TEXT PRIMARY KEY CHECK (key IN ('forgemagie_page', 'hdv_page')),
  value TEXT NOT NULL CHECK (value IN ('0', '1')),
  updated_at TEXT NOT NULL
);
INSERT INTO site_settings_new (key, value, updated_at) SELECT key, value, updated_at FROM site_settings;
DROP TABLE site_settings;
ALTER TABLE site_settings_new RENAME TO site_settings;
