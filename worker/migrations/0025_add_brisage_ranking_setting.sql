-- specs/072-classement-brisage: the owner can open the Brisage ranking tab to everyone from the administration page.
-- SQLite can't change a CHECK constraint, so the table is rebuilt with the wider key list ('brisage_ranking' added) and
-- the settings already saved are copied over. No row for the new key means « not open to everyone » (the default), so
-- nothing changes for the site until the owner turns it on.
-- Apply with: npm run worker:db:migrate-brisage-ranking
-- Apply BEFORE deploying the Workers: saving the new key would be refused by the old constraint.
-- Can be run again after a run stopped before its end: a half-built copy is thrown away first.
DROP TABLE IF EXISTS site_settings_new;
CREATE TABLE site_settings_new (
  key TEXT PRIMARY KEY CHECK (key IN ('forgemagie_page', 'hdv_page', 'search_page', 'pinned_page', 'prices_page', 'pets_page', 'brisage_page', 'brisage_ranking')),
  value TEXT NOT NULL CHECK (value IN ('0', '1')),
  updated_at TEXT NOT NULL
);
INSERT INTO site_settings_new (key, value, updated_at) SELECT key, value, updated_at FROM site_settings;
DROP TABLE site_settings;
ALTER TABLE site_settings_new RENAME TO site_settings;
