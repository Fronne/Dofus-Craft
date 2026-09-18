-- One-time migration for the already-existing production database (specs/004-community-price-sharing
-- revision 5). Unlike schema.sql's `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ADD COLUMN` is not
-- idempotent and fails if the column already exists — do not rerun this file.
-- Apply with: npm run worker:db:migrate-device-id

ALTER TABLE community_price_contributions ADD COLUMN device_id TEXT NOT NULL DEFAULT '';
