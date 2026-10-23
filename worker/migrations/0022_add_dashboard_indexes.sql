-- specs/070-admin-dashboard-graphiques: the administration dashboard counts the community prices per day and
-- origin, and the visitors per day, over the last 30 days. D1 bills the rows a query reads against the daily
-- limit this very dashboard watches, so those two reads must go through an index, not scan the whole tables.
-- Indexes only: no row is read or rewritten, and it can be applied again (IF NOT EXISTS).
-- 0019 rebuilds community_price_contributions, which drops its indexes: were it ever played again, play this one after it.
-- Apply with: npm run worker:db:migrate-dashboard-indexes
CREATE INDEX IF NOT EXISTS idx_community_price_contributions_created_at ON community_price_contributions (created_at, origin);
CREATE INDEX IF NOT EXISTS idx_app_visits_day ON app_visits (day);
