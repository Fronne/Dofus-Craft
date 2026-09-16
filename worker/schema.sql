-- Community price sharing (specs/004-community-price-sharing), Cloudflare D1 (SQLite) schema.
--
-- Apply with: npm run worker:db:init (wrangler d1 execute ... --file worker/schema.sql)
-- once the D1 database itself has been created (wrangler d1 create dofus-craft-community-prices)
-- and its id/binding set in worker/wrangler.toml.
--
-- Unlike the previously-considered Postgres/Supabase design, there is no public database API and
-- no Row Level Security here: the Worker in src/index.ts is the *only* thing with access to this
-- database, so access control is enforced entirely by what that Worker's endpoints choose to
-- expose (FR-007: raw contributions are never returned by any endpoint, only the aggregated
-- median computed in src/median.ts).

CREATE TABLE IF NOT EXISTS community_price_contributions (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL,
  server_id TEXT NOT NULL,
  amount_kamas INTEGER NOT NULL CHECK (amount_kamas >= 0),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Every read is scoped to a single (resource_id, server_id) pair (FR-001/FR-003).
CREATE INDEX IF NOT EXISTS idx_community_price_contributions_lookup
  ON community_price_contributions (resource_id, server_id, created_at);
