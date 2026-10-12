-- specs/045-restore-production-worker: a purchase line the player corrected keeps what was read first.
-- Written from the production database's structure (the original migration is lost); production
-- already has these columns.
ALTER TABLE fm_purchase_lines ADD COLUMN original_quantity INTEGER;
ALTER TABLE fm_purchase_lines ADD COLUMN original_total_kamas INTEGER;
ALTER TABLE fm_purchase_lines ADD COLUMN corrected_at TEXT;
