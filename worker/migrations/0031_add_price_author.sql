-- specs/082-auteur-prix-communautaires: who entered a community price. NULL = no author (a visitor who
-- was not logged in, a price from before this feature, or one whose author deleted their profile).
-- Only the prices entered on the site by a logged-in player carry one; the pseudonym shown for it is
-- read from fm_players at read time, so it follows the player's name and privacy setting.
ALTER TABLE community_price_contributions ADD COLUMN author_discord_user_id TEXT;
CREATE INDEX IF NOT EXISTS idx_community_price_contributions_author
  ON community_price_contributions (author_discord_user_id, created_at);
