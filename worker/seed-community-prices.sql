-- Local-only test data for the community price sharing mode (see worker/schema.sql).
--
-- Run ONLY against the emulated LOCAL D1 database (never --remote, which would write fake
-- contributions into the real production data used by computeCommunityMedian / the moderator
-- outlier query):
--   wrangler d1 execute dofus-craft-community-prices --config worker/wrangler.toml --local --file worker/seed-community-prices.sql
--
-- Prerequisite: the local D1 emulation must already have the schema applied once, e.g.
--   wrangler d1 execute dofus-craft-community-prices --config worker/wrangler.toml --local --file worker/schema.sql
--   wrangler d1 execute dofus-craft-community-prices --config worker/wrangler.toml --local --file worker/migrations/0001_add_device_id.sql
--   wrangler d1 execute dofus-craft-community-prices --config worker/wrangler.toml --local --file worker/migrations/0002_add_app_visits.sql
--   wrangler d1 execute dofus-craft-community-prices --config worker/wrangler.toml --local --file worker/migrations/0003_add_outlier_tracking.sql
--
-- D1 disallows CREATE TEMP TABLE ("not authorized: SQLITE_AUTH"), so the target list below is a
-- plain VALUES-derived table referenced positionally (column1/column2/column3) rather than a
-- named temp table.
--
-- 1) Edit this list: (resource_id, server_id, base_price_kamas). Defaults are real DofusDB item
--    ids (resource_id = String(item.id), see src/services/dofusdb-mappers.ts) and real permanent
--    mono-account server slugs (server_id = slugify(name.fr)): Ortie (421), Eau Potable (311),
--    Argent (350), on Mikhal and Dakal — pick these (or your own) so they show up when browsing
--    the running app.

-- 2) ~10 ordinary contributions per target, jittered +/-15% around base_price and spread over the
--    last 0-89 days. This gives a stable median per pair, exercises the 90-day retention window,
--    and gives specs/008-stale-resource-highlight some old-enough rows to flag as stale.
WITH RECURSIVE seq(n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM seq WHERE n < 10
)
INSERT INTO community_price_contributions
  (id, resource_id, server_id, amount_kamas, device_id, created_at)
SELECT
  lower(hex(randomblob(16))),
  t.column1,
  t.column2,
  MAX(1, CAST(t.column3 * (0.85 + (abs(random()) % 31) / 100.0) AS INTEGER)),
  'seed-device-' || lower(hex(randomblob(4))),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-' || (abs(random()) % 90) || ' days')
FROM (VALUES
  ('421', 'mikhal', 15),
  ('421', 'dakal', 22),
  ('311', 'mikhal', 8),
  ('311', 'dakal', 10),
  ('350', 'mikhal', 1200),
  ('350', 'dakal', 950)
) AS t
JOIN seq ON 1 = 1;

-- 3) One deliberate outlier per target (3x base_price, submitted "now"), to exercise
--    specs/007-outlier-confirmation's client-side confirmation dialog and the moderator query
--    `WHERE deviation_percent > 25` against this table.
INSERT INTO community_price_contributions
  (id, resource_id, server_id, amount_kamas, device_id, created_at, median_at_submission_kamas, deviation_percent)
SELECT
  lower(hex(randomblob(16))),
  t.column1,
  t.column2,
  t.column3 * 3,
  'seed-device-outlier-' || lower(hex(randomblob(4))),
  strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
  t.column3,
  200.0
FROM (VALUES
  ('421', 'mikhal', 15),
  ('421', 'dakal', 22),
  ('311', 'mikhal', 8),
  ('311', 'dakal', 10),
  ('350', 'mikhal', 1200),
  ('350', 'dakal', 950)
) AS t;
