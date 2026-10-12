-- specs/045-restore-production-worker: the name as it was read when it had to be recovered, and whether
-- the line counts in the spending (only runes do). Written from the production database's structure
-- (the original migrations are lost); production already has these columns.
ALTER TABLE fm_purchase_lines ADD COLUMN original_item_name TEXT;
ALTER TABLE fm_purchase_lines ADD COLUMN counted INTEGER NOT NULL DEFAULT 1;
