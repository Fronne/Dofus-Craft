-- specs/058-prix-par-lot: the last price seen for each HDV lot size (1, 10, 100, 1000) of a resource.
-- A new table only: no existing row is read or rewritten, so there is no write cost on the free plan.
-- The contributions already stored stay the lot 1 price (read as a fallback, never copied here).
-- Apply with: npm run worker:db:migrate-lot-prices
CREATE TABLE IF NOT EXISTS community_price_lots (
  resource_id TEXT NOT NULL,
  server_id TEXT NOT NULL,
  lot_size INTEGER NOT NULL CHECK (lot_size IN (1, 10, 100, 1000)),
  -- The price of the whole lot, as the HDV lists it; the unit price is this over lot_size.
  lot_price_kamas INTEGER NOT NULL CHECK (lot_price_kamas > 0),
  observed_at TEXT NOT NULL,
  -- The sniffer key that sent it. Never returned by the API.
  device_id TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (resource_id, server_id, lot_size)
);
