// specs/082-auteur-prix-communautaires: the pseudonym of a contribution's author, read with the contribution —
// only when the author's profile is public (is_private = 0), so a private or deleted profile gives NULL. The
// Discord id never leaves the Worker. `c` is the alias of community_price_contributions in the query.
export const AUTHOR_JOIN_SQL = 'LEFT JOIN fm_players p ON p.discord_user_id = c.author_discord_user_id';
export const AUTHOR_NAME_SQL = 'CASE WHEN p.is_private = 0 THEN p.display_name END';
