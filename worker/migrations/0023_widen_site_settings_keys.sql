-- specs/071-admin-dashboard-moderne: the owner can turn every page of the site on or off, not only Forgemagie and
-- HDV. SQLite can't change a CHECK constraint, so the table is rebuilt with the wider key list and the settings
-- already saved (forgemagie_page, hdv_page) are copied over. A page with no row keeps its default (enabled, except
-- Forgemagie), so nothing changes for the site until the owner saves a new setting.
-- Apply with: npm run worker:db:migrate-site-pages
-- Apply BEFORE deploying the Workers: saving a new key would be refused by the old constraint.
-- Can be run again after a run stopped before its end: a half-built copy is thrown away first.
DROP TABLE IF EXISTS site_settings_new;
CREATE TABLE site_settings_new (
  key TEXT PRIMARY KEY CHECK (key IN ('forgemagie_page', 'hdv_page', 'search_page', 'pinned_page', 'prices_page', 'pets_page', 'brisage_page')),
  value TEXT NOT NULL CHECK (value IN ('0', '1')),
  updated_at TEXT NOT NULL
);
INSERT INTO site_settings_new (key, value, updated_at) SELECT key, value, updated_at FROM site_settings;
DROP TABLE site_settings;
ALTER TABLE site_settings_new RENAME TO site_settings;
