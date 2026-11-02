-- specs/075-connexion-discord-site: the Discord login serves the whole site, not only the Forgemagie.
-- A player may now log in without being a member of the group's Discord server: the sessions say whether
-- they were (every session made before this migration was, the old login required it), and a profile can
-- carry a class icon.
ALTER TABLE fm_players ADD COLUMN breed_id INTEGER;
ALTER TABLE fm_auth_sessions ADD COLUMN is_member INTEGER NOT NULL DEFAULT 1 CHECK (is_member IN (0, 1));
