-- specs/016-shared-item-prices: tells an item's HDV price apart from a resource price, so the 90-day
-- purge only spares the latest item price (constitution, principle V) and the outlier trace can be
-- filtered per kind. Existing rows are all resource prices, hence the default. Adds the column to the
-- already-existing production table (see worker/schema.sql for freshly created databases). Run once
-- via `npm run worker:db:migrate-contribution-kind`, before deploying the Worker that uses it.
ALTER TABLE community_price_contributions ADD COLUMN kind TEXT NOT NULL DEFAULT 'resource'
  CHECK (kind IN ('resource', 'item'));
