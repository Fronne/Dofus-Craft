-- specs/006-anonymous-visit-count. Unlike 0001_add_device_id.sql, this migration IS safely
-- rerunnable (CREATE TABLE IF NOT EXISTS), since it creates a brand-new table rather than altering
-- an existing one. Apply with: npm run worker:db:migrate-visits

CREATE TABLE IF NOT EXISTS app_visits (
  device_id TEXT NOT NULL,
  day TEXT NOT NULL,
  PRIMARY KEY (device_id, day)
);
