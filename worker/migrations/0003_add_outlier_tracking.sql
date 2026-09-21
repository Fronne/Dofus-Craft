-- specs/007-outlier-confirmation: adds outlier-tracking columns to the already-existing production
-- table (see worker/schema.sql for the equivalent CREATE TABLE column, applied only to freshly
-- created databases). Run once via `npm run worker:db:migrate-outlier-tracking`.
ALTER TABLE community_price_contributions ADD COLUMN median_at_submission_kamas INTEGER;
ALTER TABLE community_price_contributions ADD COLUMN deviation_percent REAL;
