-- specs/071-sniffer-tous-hdv: the nature of a price sent by the friends' tool — equipment, resource, rune
-- or consumable — from the DofusDB item type of the HDV. NULL for every existing row, manual entries and
-- tools older than 0.4.0. `kind` is unchanged: it still decides how the price is read (median or latest).
-- An added column with no default rewrites no row: no write cost on the free plan.
-- Apply with: npm run worker:db:migrate-item-type
ALTER TABLE community_price_contributions ADD COLUMN item_type TEXT
  CHECK (item_type IN ('equipment', 'resource', 'rune', 'consumable'));
