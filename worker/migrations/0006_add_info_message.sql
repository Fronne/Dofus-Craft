-- specs/020-info-banner: the one information message shown as a banner on the site, read publicly
-- (GET /info-message) and written only through the Access-protected dofus-craft-admin Worker.
-- Apply with: npm run worker:db:migrate-info-message
CREATE TABLE IF NOT EXISTS info_message (
  id TEXT PRIMARY KEY CHECK (id = 'current'),
  text TEXT NOT NULL,
  tone TEXT NOT NULL CHECK (tone IN ('info', 'important')),
  ends_at TEXT,
  updated_at TEXT NOT NULL
);
