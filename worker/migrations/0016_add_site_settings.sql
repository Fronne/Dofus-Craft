-- specs/050-forgemagie-page-toggle: the owner's site settings, read publicly (GET /site-settings) and
-- written only through the Access-protected dofus-craft-admin Worker. One row per setting; no row
-- means the setting's default (the Forgemagie page is disabled).
-- Apply with: npm run worker:db:migrate-site-settings
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY CHECK (key IN ('forgemagie_page')),
  value TEXT NOT NULL CHECK (value IN ('0', '1')),
  updated_at TEXT NOT NULL
);
